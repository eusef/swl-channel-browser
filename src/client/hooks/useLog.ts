import { useState, useEffect, useCallback } from 'react';
import { ReceptionLogEntry } from '../../shared/types';
import { fetchLog, addLogEntryApi, removeLogEntryApi, exportLogCsv } from '../lib/schedule';

export function useLog() {
  const [entries, setEntries] = useState<ReceptionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const log = await fetchLog();
      setEntries(log);
    } catch (err) {
      console.error('Failed to fetch log:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async (data: Omit<ReceptionLogEntry, 'id' | 'logged_at'>) => {
    try {
      await addLogEntryApi(data);
      await refresh();
    } catch (err) {
      console.error('Failed to add log entry:', err);
    }
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    try {
      await removeLogEntryApi(id);
      await refresh();
    } catch (err) {
      console.error('Failed to remove log entry:', err);
    }
  }, [refresh]);

  const downloadCsv = useCallback(async () => {
    try {
      const csv = await exportLogCsv();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reception-log.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export CSV:', err);
    }
  }, []);

  return { entries, loading, add, remove, downloadCsv, refresh };
}
