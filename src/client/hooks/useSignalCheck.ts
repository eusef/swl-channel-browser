import { useState, useRef, useCallback } from 'react';
import { Broadcast } from '../../shared/types';
import { SDRConnectClient } from '../lib/sdrconnect';

export interface SignalReading {
  power: number;
  snr: number;
}

export function signalKey(freq_khz: number, station: string): string {
  return `${freq_khz}:${station}`;
}

export function useSignalCheck(getClient: () => SDRConnectClient | null) {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [readings, setReadings] = useState<Map<string, SignalReading>>(new Map());
  const [sortBySignal, setSortBySignal] = useState(false);

  const cancelledRef = useRef(false);
  const scanningRef = useRef(false);

  const startScan = useCallback(async (
    broadcasts: Broadcast[],
    dwellMs: number,
    onComplete?: (previousBroadcast: Broadcast | null) => void,
    previousBroadcast?: Broadcast | null,
  ) => {
    const client = getClient();
    if (!client || !client.isConnected() || scanningRef.current) return;

    scanningRef.current = true;
    cancelledRef.current = false;
    setIsScanning(true);
    setProgress(0);
    setTotal(broadcasts.length);
    setReadings(new Map());
    setSortBySignal(false);

    const results = new Map<string, SignalReading>();

    for (let i = 0; i < broadcasts.length; i++) {
      if (cancelledRef.current) break;

      const b = broadcasts[i];
      setProgress(i + 1);

      // Tune to this station
      client.tune(b.freq_hz);
      client.setDemodulator(b.demod_mode);
      client.setBandwidth(b.bandwidth);

      // Collect signal readings during dwell period
      let lastPower = NaN;
      let lastSnr = NaN;

      const unsub = client.onSignalUpdate((p, s) => {
        if (!isNaN(p)) lastPower = p;
        if (!isNaN(s)) lastSnr = s;
      });

      // Wait for dwell time
      await new Promise<void>(resolve => setTimeout(resolve, dwellMs));

      unsub();

      const key = signalKey(b.freq_khz, b.station);
      results.set(key, { power: lastPower, snr: lastSnr });

      // Update state incrementally so UI shows progress
      setReadings(new Map(results));
    }

    scanningRef.current = false;
    setIsScanning(false);

    // Restore previously tuned station
    if (!cancelledRef.current && previousBroadcast) {
      client.tune(previousBroadcast.freq_hz);
      client.setDemodulator(previousBroadcast.demod_mode);
      client.setBandwidth(previousBroadcast.bandwidth);
    }

    onComplete?.(previousBroadcast ?? null);
  }, [getClient]);

  const cancelScan = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const clearResults = useCallback(() => {
    setReadings(new Map());
    setSortBySignal(false);
  }, []);

  const toggleSortBySignal = useCallback(() => {
    setSortBySignal(prev => !prev);
  }, []);

  return {
    isScanning,
    progress,
    total,
    readings,
    sortBySignal,
    startScan,
    cancelScan,
    clearResults,
    toggleSortBySignal,
  };
}
