import { useState, useEffect, useCallback, useRef } from 'react';
import { Broadcast, ScheduleFilters } from '../../shared/types';
import { fetchScheduleNow, fetchScheduleUpcoming } from '../lib/schedule';

export function useSchedule(filters: ScheduleFilters, mode: 'now' | 'upcoming' = 'now', hours = 3) {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [utcTime, setUtcTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data =
        mode === 'now'
          ? await fetchScheduleNow(filtersRef.current)
          : await fetchScheduleUpcoming(hours, filtersRef.current);
      setBroadcasts(data.broadcasts);
      setUtcTime(data.utc_time);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, [mode, hours]);

  // Load on mount and when filters/mode change
  useEffect(() => {
    load();
  }, [load, filters.band, filters.lang, filters.target, filters.q, filters.sort, filters.order]);

  // Auto-refresh every 30s to catch UTC hour boundaries
  useEffect(() => {
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  return { broadcasts, utcTime, loading, error, refresh: load };
}
