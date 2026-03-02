import { DemodMode } from '../../shared/types';

type SignalCallback = (power: number, snr: number) => void;
type PropertyCallback = (prop: string, value: string) => void;
type AudioCallback = (samples: Int16Array) => void;
type SpectrumCallback = (bins: Uint8Array) => void;
type ConnectionCallback = (connected: boolean) => void;
type VersionErrorCallback = () => void;

const SPECTRUM_HEADER = 0x0003;

export class SDRConnectClient {
  private ws: WebSocket | null = null;
  private wsUrl = '';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private _connected = false;
  private signalPollTimer: ReturnType<typeof setInterval> | null = null;

  private signalCallbacks: SignalCallback[] = [];
  private propertyCallbacks: PropertyCallback[] = [];
  private audioCallbacks: AudioCallback[] = [];
  private spectrumCallbacks: SpectrumCallback[] = [];
  private connectionCallbacks: ConnectionCallback[] = [];
  private versionErrorCallbacks: VersionErrorCallback[] = [];
  private _versionCheckTimer: ReturnType<typeof setTimeout> | null = null;

  /** Device center frequency in Hz (the true center of the spectrum span) */
  private _deviceCenterHz: number | null = null;

  /** Device sample rate in Hz (determines spectrum span width) */
  private _deviceSampleRate: number | null = null;

  /** All SDR properties received from SDRconnect (initial dump + live updates) */
  private _properties = new Map<string, string>();

  /** Device serial number for selection (empty string = use index 0) */
  private _deviceSerial = '';

  /** Whether we've already sent a device selection command this session */
  private _deviceSelectionSent = false;

  // Diagnostic: log first few text messages to understand SDRconnect event format
  private _textMsgCount = 0;

  connect(deviceSerial?: string): void {
    // Always connect through the backend proxy
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.wsUrl = `${protocol}//${window.location.host}/ws/sdr`;
    this.reconnectDelay = 1000;
    if (deviceSerial !== undefined) {
      this._deviceSerial = deviceSerial;
    }
    this._connect();
  }

  private _connect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    try {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this._connected = true;
        this.reconnectDelay = 1000;
        this._textMsgCount = 0;
        this._properties.clear();
        this._deviceSelectionSent = false;
        this.connectionCallbacks.forEach(cb => cb(true));

        // Version/connectivity check: if we don't receive any property data
        // within 5 seconds, the server is likely < 1.0.7 or misconfigured.
        this.startVersionCheck();

        // Read initial state. The response to device_vfo_frequency tells us
        // whether a device is already active (GUI mode) or needs selection
        // (headless mode). See handleTextMessage for the follow-up logic.
        this.getProperty('device_vfo_frequency');
        this.getProperty('device_center_frequency');
        this.getProperty('device_sample_rate');
        this.getProperty('iq_sample_rate');
        this.getProperty('demodulator');
        this.getProperty('filter_bandwidth');

        // Start polling signal_power and signal_snr every 2 seconds
        // (SDRconnect may not auto-push these in all streaming modes)
        this.startSignalPolling();
      };

      this.ws.onclose = () => {
        this._connected = false;
        this.stopSignalPolling();
        this.connectionCallbacks.forEach(cb => cb(false));
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // onclose will fire after this
      };

      this.ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          this.handleTextMessage(event.data);
        } else if (event.data instanceof ArrayBuffer) {
          this.handleBinaryMessage(event.data);
        }
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private startSignalPolling(): void {
    this.stopSignalPolling();
    // Poll immediately, then every 2 seconds
    this.getProperty('signal_power');
    this.getProperty('signal_snr');
    this.signalPollTimer = setInterval(() => {
      this.getProperty('signal_power');
      this.getProperty('signal_snr');
    }, 2000);
  }

  private stopSignalPolling(): void {
    if (this.signalPollTimer) {
      clearInterval(this.signalPollTimer);
      this.signalPollTimer = null;
    }
  }

  private startVersionCheck(): void {
    this.cancelVersionCheck();
    this._versionCheckTimer = setTimeout(() => {
      // If we haven't received any property data at all, the server is not
      // responding to our requests - likely < 1.0.7 or WebSocket API disabled.
      if (this._properties.size === 0) {
        console.warn('[SDR] Version check failed: no property data received. SDRconnect >= 1.0.7 is required.');
        this.versionErrorCallbacks.forEach(cb => cb());
      }
    }, 5000);
  }

  private cancelVersionCheck(): void {
    if (this._versionCheckTimer) {
      clearTimeout(this._versionCheckTimer);
      this._versionCheckTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  disconnect(): void {
    this.stopSignalPolling();
    this.cancelVersionCheck();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
    this.connectionCallbacks.forEach(cb => cb(false));
  }

  isConnected(): boolean {
    return this._connected;
  }

  getUrl(): string {
    return this.wsUrl;
  }

  /** Get the device center frequency in Hz (null if not yet received) */
  getDeviceCenterHz(): number | null {
    return this._deviceCenterHz;
  }

  /** Get the device sample rate in Hz (null if not yet received) */
  getDeviceSampleRate(): number | null {
    return this._deviceSampleRate;
  }

  /** Get a single SDR property value (returns undefined if not yet received) */
  getPropertyValue(property: string): string | undefined {
    return this._properties.get(property);
  }

  /** Get all stored SDR properties as a plain object snapshot */
  getAllProperties(): Record<string, string> {
    return Object.fromEntries(this._properties);
  }

  private send(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private getProperty(property: string): void {
    this.send({ event_type: 'get_property', property });
  }

  /** DC spike offset in Hz. At sample rates > 2 MHz, SDRconnect uses Zero-IF
   *  mode which places a DC spike at the center frequency. Software removes it,
   *  but it also removes any signal there. Offset the center by 11 kHz (matching
   *  SDRuno behavior) so the tuned signal avoids the spike. At ≤ 2 MHz, Low-IF
   *  mode is used and no offset is needed. */
  private static readonly DC_OFFSET_HZ = 11000;
  private static readonly ZERO_IF_THRESHOLD_HZ = 2000000;

  tune(freqHz: number): void {
    // Set VFO frequency, then center the spectrum display near it.
    // Both writes are supported as of SDRconnect 1.0.7.
    this.send({
      event_type: 'set_property',
      property: 'device_vfo_frequency',
      value: String(freqHz),
    });

    // In Zero-IF mode (sample rate > 2 MHz), offset center frequency to avoid
    // the DC spike. In Low-IF mode (≤ 2 MHz), center directly on the VFO.
    const sampleRate = this._deviceSampleRate || 0;
    const centerHz = sampleRate > SDRConnectClient.ZERO_IF_THRESHOLD_HZ
      ? freqHz + SDRConnectClient.DC_OFFSET_HZ
      : freqHz;
    this.send({
      event_type: 'set_property',
      property: 'device_center_frequency',
      value: String(centerHz),
    });
  }

  setCenterFrequency(freqHz: number): void {
    this.send({
      event_type: 'set_property',
      property: 'device_center_frequency',
      value: String(freqHz),
    });
  }

  setDemodulator(mode: DemodMode): void {
    this.send({
      event_type: 'set_property',
      property: 'demodulator',
      value: mode,
    });
  }

  setBandwidth(hz: number): void {
    this.send({
      event_type: 'set_property',
      property: 'filter_bandwidth',
      value: String(hz),
    });
  }

  setSampleRate(hz: number): void {
    this.send({
      event_type: 'set_property',
      property: 'device_sample_rate',
      value: String(hz),
    });
  }

  /** Select device by index (e.g. "0") or serial number */
  selectDevice(identifier: string, method: 'index' | 'serial' = 'index'): void {
    const eventType = method === 'serial' ? 'selected_device_serial' : 'selected_device';
    this.send({ event_type: eventType, value: identifier });
  }

  /** Generic property setter for SDRconnect properties */
  setProperty(property: string, value: string): void {
    this.send({
      event_type: 'set_property',
      property,
      value,
    });
  }

  startAudio(): void {
    this.send({ event_type: 'audio_stream_enable', value: 'true' });
  }

  stopAudio(): void {
    this.send({ event_type: 'audio_stream_enable', value: 'false' });
  }

  setAntennaPort(port: string): void {
    this.send({
      event_type: 'set_property',
      property: 'antenna_select',
      value: port,
    });
  }

  startSpectrum(): void {
    this.send({ event_type: 'spectrum_enable', value: 'true' });
  }

  stopSpectrum(): void {
    this.send({ event_type: 'spectrum_enable', value: 'false' });
  }

  private handleTextMessage(data: string): void {
    try {
      const msg = JSON.parse(data);
      const { event_type, property, value } = msg;

      // Log first 50 text messages with full detail, and always log get_property_response
      if (this._textMsgCount < 50 || event_type === 'get_property_response') {
        console.log('[SDR WS]', JSON.stringify(msg));
        this._textMsgCount++;
      }

      if (event_type === 'property_changed' || event_type === 'get_property_response') {
        // Store every property for full state access
        if (property && value !== undefined) {
          this._properties.set(property, value);
        }

        // Any property response confirms the server is alive, cancel version check
        this.cancelVersionCheck();

        // If VFO frequency is "0", no device is active (headless mode).
        // Send device selection to open and start streaming.
        if (property === 'device_vfo_frequency' && value === '0' && !this._deviceSelectionSent) {
          this._deviceSelectionSent = true;
          console.log('[SDR] No active device detected (VFO=0), sending device selection');
          if (this._deviceSerial) {
            this.selectDevice(this._deviceSerial, 'serial');
          } else {
            this.selectDevice('0', 'index');
          }
        }

        this.propertyCallbacks.forEach(cb => cb(property, value));

        if (property === 'device_center_frequency') {
          this._deviceCenterHz = parseFloat(value);
        } else if (property === 'device_sample_rate') {
          this._deviceSampleRate = parseFloat(value);
        } else if (property === 'signal_power') {
          const power = parseFloat(value);
          this.signalCallbacks.forEach(cb => cb(power, NaN));
        } else if (property === 'signal_snr') {
          const snr = parseFloat(value);
          this.signalCallbacks.forEach(cb => cb(NaN, snr));
        }
      }
    } catch {
      // ignore malformed messages
    }
  }

  private _binaryLogCount = 0;

  private handleBinaryMessage(data: ArrayBuffer): void {
    const int16View = new Int16Array(data);

    if (int16View[0] === SPECTRUM_HEADER) {
      // Spectrum data: skip first 2 bytes (Int16 header), rest is Uint8 bins
      const bins = new Uint8Array(data, 2);
      if (this._binaryLogCount < 3) {
        console.log('[SDR Spectrum]', `totalBytes=${data.byteLength}, binsLength=${bins.length}, header=[${int16View[0]}, ${int16View[1]}]`);
        this._binaryLogCount++;
      }
      this.spectrumCallbacks.forEach(cb => cb(bins));
      return;
    }

    // Treat other binary data as audio PCM
    this.audioCallbacks.forEach(cb => cb(new Int16Array(data)));
  }

  onSignalUpdate(cb: SignalCallback): () => void {
    this.signalCallbacks.push(cb);
    return () => {
      this.signalCallbacks = this.signalCallbacks.filter(c => c !== cb);
    };
  }

  onPropertyChange(cb: PropertyCallback): () => void {
    this.propertyCallbacks.push(cb);
    return () => {
      this.propertyCallbacks = this.propertyCallbacks.filter(c => c !== cb);
    };
  }

  onAudioData(cb: AudioCallback): () => void {
    this.audioCallbacks.push(cb);
    return () => {
      this.audioCallbacks = this.audioCallbacks.filter(c => c !== cb);
    };
  }

  onSpectrumData(cb: SpectrumCallback): () => void {
    this.spectrumCallbacks.push(cb);
    return () => {
      this.spectrumCallbacks = this.spectrumCallbacks.filter(c => c !== cb);
    };
  }

  onConnectionChange(cb: ConnectionCallback): () => void {
    this.connectionCallbacks.push(cb);
    return () => {
      this.connectionCallbacks = this.connectionCallbacks.filter(c => c !== cb);
    };
  }

  /** Fires if SDRconnect appears to be < 1.0.7 (no "started" property after device selection) */
  onVersionError(cb: VersionErrorCallback): () => void {
    this.versionErrorCallbacks.push(cb);
    return () => {
      this.versionErrorCallbacks = this.versionErrorCallbacks.filter(c => c !== cb);
    };
  }
}
