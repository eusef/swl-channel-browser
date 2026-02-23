import { useState, useEffect, useRef } from 'react';
import { PropagationData } from '../../shared/types';
import { fetchPropagationApi } from '../lib/schedule';

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes (matches backend cache TTL)

export function usePropagation() {
  const [propagation, setPropagation] = useState<PropagationData | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchPropagationApi();
        if (!cancelled) {
          setPropagation(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('[usePropagation] Fetch error:', err);
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    timerRef.current = setInterval(load, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return { propagation, loading };
}
