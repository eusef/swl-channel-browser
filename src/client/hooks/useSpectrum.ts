import { useEffect, useRef } from 'react';
import { SDRConnectClient } from '../lib/sdrconnect';
import { ConnectionStatus } from './useWebSocket';

/**
 * Find the index of the maximum value in a Uint8Array.
 */
function findPeakBin(bins: Uint8Array): number {
  let maxVal = 0;
  let maxIdx = 0;
  for (let i = 0; i < bins.length; i++) {
    if (bins[i] > maxVal) {
      maxVal = bins[i];
      maxIdx = i;
    }
  }
  return maxIdx;
}

/**
 * Hook for subscribing to real-time spectrum data from SDRconnect.
 *
 * Performance: Stores bins in a ref (not state) to avoid re-renders on every
 * spectrum frame. Canvas components read binsRef directly via requestAnimationFrame.
 *
 * Peak centering: Tracks the signal peak with exponential smoothing and exposes
 * a shift value so display components can center the tuned signal.
 */
export function useSpectrum(
  getClient: () => SDRConnectClient | null,
  connectionStatus: ConnectionStatus,
  enabled: boolean,
) {
  const binsRef = useRef<Uint8Array | null>(null);
  const frameCountRef = useRef(0);
  /** Number of bins to shift right so the peak ends up at center */
  const peakShiftRef = useRef(0);
  const smoothedPeakRef = useRef(-1);

  useEffect(() => {
    const client = getClient();
    if (!client || !enabled) {
      return;
    }

    // Reset smoothing on new connection/enable
    smoothedPeakRef.current = -1;
    peakShiftRef.current = 0;

    // Enable spectrum streaming
    client.startSpectrum();

    // Subscribe to spectrum frames
    const unsub = client.onSpectrumData((bins: Uint8Array) => {
      binsRef.current = bins;
      frameCountRef.current += 1;

      // Center the peak on the first frame only; hold the shift steady
      // so the waterfall doesn't drift while listening to a station.
      if (smoothedPeakRef.current < 0) {
        const peakIdx = findPeakBin(bins);
        smoothedPeakRef.current = peakIdx;
        const center = Math.floor(bins.length / 2);
        peakShiftRef.current = center - peakIdx;
      }
    });

    return () => {
      unsub();
      client.stopSpectrum();
      binsRef.current = null;
      peakShiftRef.current = 0;
      smoothedPeakRef.current = -1;
    };
  }, [getClient, connectionStatus, enabled]);

  return { binsRef, frameCountRef, peakShiftRef };
}
