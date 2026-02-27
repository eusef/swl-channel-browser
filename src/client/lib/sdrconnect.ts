import { DemodMode } from '../../shared/types';

type SignalCallback = (power: number, snr: number) => void;
type PropertyCallback = (prop: string, value: string) => void;
type AudioCallback = (samples: Int16Array) => void;
type SpectrumCallback = (bins: Uint8Array) => void;
type ConnectionCallback = (connected: boolean) => void;

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

  // Diagnostic: log first few text messages to understand SDRconnect event format
  private _textMsgCount = 0;

  connect(): void {
    // Always connect through the backend proxy
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.wsUrl = `${protocol}//${window.location.host}/ws/sdr`;
    this.reconnectDelay = 1000;
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
        this.connectionCallbacks.forEach(cb => cb(true));

        // Read initial state
        this.getProperty('device_vfo_frequency');
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

  private send(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private getProperty(property: string): void {
    this.send({ event_type: 'get_property', property });
  }

  tune(freqHz: number): void {
    // SDRconnect recenters the display on every VFO change that falls outside
    // the current visible span, placing the VFO at ~10% from the left edge.
    // This position is well within the usable bandwidth (100kHz from edge in
    // a 1 MHz span) so reception quality is not affected. The WebSocket API
    // does not support setting device_center_frequency, so we cannot control
    // where the VFO appears on the display.
    this.send({
      event_type: 'set_property',
      property: 'device_vfo_frequency',
      value: String(freqHz),
    });
  }

  setCenterFrequency(_freqHz: number): void {
    // NOTE: SDRconnect ignores device_center_frequency via WebSocket API.
    // This method is kept for API compatibility but is a no-op.
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

      // Log first 20 text messages for diagnostics
      if (this._textMsgCount < 20) {
        console.log('[SDR WS]', msg);
        this._textMsgCount++;
      }

      const { event_type, property, value } = msg;

      if (event_type === 'property_changed' || event_type === 'get_property_response') {
        this.propertyCallbacks.forEach(cb => cb(property, value));

        if (property === 'signal_power') {
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

  private handleBinaryMessage(data: ArrayBuffer): void {
    const int16View = new Int16Array(data);

    if (int16View[0] === SPECTRUM_HEADER) {
      // Spectrum data: skip first 2 bytes (Int16 header), rest is Uint8 bins
      const bins = new Uint8Array(data, 2);
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
}
