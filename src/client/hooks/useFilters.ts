import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ScheduleFilters, FiltersResponse } from '../../shared/types';
import { fetchFilters } from '../lib/schedule';

export function useFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [available, setAvailable] = useState<FiltersResponse>({ bands: [], languages: [], targets: [] });

  const filters: ScheduleFilters = {
    band: searchParams.get('band') || undefined,
    lang: searchParams.get('lang') || undefined,
    target: searchParams.get('target') || undefined,
    q: searchParams.get('q') || undefined,
    sort: searchParams.get('sort') || undefined,
    order: (searchParams.get('order') as 'asc' | 'desc') || undefined,
  };

  useEffect(() => {
    fetchFilters().then(setAvailable).catch(console.error);
  }, []);

  const setFilter = useCallback(
    (key: string, value: string | undefined) => {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
        return next;
      });
    },
    [setSearchParams]
  );

  const clearFilters = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  return { filters, available, setFilter, clearFilters };
}
