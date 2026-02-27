import { useState, useEffect, useRef } from 'react';
import { Broadcast } from '../../shared/types';
import { fetchNearbyBroadcasts } from '../lib/schedule';

/**
 * Hook that fetches EiBi broadcasts within the visible spectrum range.
 * Re-fetches when the center frequency changes by more than 100 kHz,
 * debounced to avoid hammering the API during drag-to-pan.
 */
export function useNearbyBroadcasts(
  centerFreqKhz: number | null,
  spanKhz: number = 1000,
) {
  const [nearby, setNearby] = useState<Broadcast[]>([]);
  const lastFetchedRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!centerFreqKhz) {
      setNearby([]);
      return;
    }

    // Only re-fetch if frequency changed by > 100 kHz from last fetch
    const delta = Math.abs(centerFreqKhz - lastFetchedRef.current);
    if (delta < 100 && lastFetchedRef.current > 0) return;

    // Debounce: wait 500ms after last change before fetching
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const resp = await fetchNearbyBroadcasts(centerFreqKhz, spanKhz);
        setNearby(resp.broadcasts);
        lastFetchedRef.current = centerFreqKhz;
      } catch {
        // Silently ignore fetch errors (non-critical overlay)
      }
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [centerFreqKhz, spanKhz]);

  return nearby;
}
