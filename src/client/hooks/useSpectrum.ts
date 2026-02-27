import { useEffect, useRef } from 'react';
import { SDRConnectClient } from '../lib/sdrconnect';
import { ConnectionStatus } from './useWebSocket';

/**
 * Hook for subscribing to real-time spectrum data from SDRconnect.
 *
 * Performance: Stores bins in a ref (not state) to avoid re-renders on every
 * spectrum frame. Canvas components read binsRef directly via requestAnimationFrame.
 *
 * The spectrum data represents 256 bins covering a 1 MHz span centered on
 * device_center_frequency (read from SDRconnect). No peak centering is needed
 * since we use the real center frequency for mapping.
 */
export function useSpectrum(
  getClient: () => SDRConnectClient | null,
  connectionStatus: ConnectionStatus,
  enabled: boolean,
) {
  const binsRef = useRef<Uint8Array | null>(null);
  const frameCountRef = useRef(0);
  /** Kept for API compatibility but always 0 (no peak shifting needed) */
  const peakShiftRef = useRef(0);

  useEffect(() => {
    const client = getClient();
    if (!client || !enabled) {
      return;
    }

    peakShiftRef.current = 0;

    // Enable spectrum streaming
    client.startSpectrum();

    // Subscribe to spectrum frames
    const unsub = client.onSpectrumData((bins: Uint8Array) => {
      binsRef.current = bins;
      frameCountRef.current += 1;
    });

    return () => {
      unsub();
      client.stopSpectrum();
      binsRef.current = null;
      peakShiftRef.current = 0;
    };
  }, [getClient, connectionStatus, enabled]);

  return { binsRef, frameCountRef, peakShiftRef };
}
