import { useState, useCallback } from 'react';
import { ManualEntry, DemodMode } from '../../shared/types';
import { bandwidthForMode, deriveDemodFromFreq, createSyntheticBroadcast } from '../lib/frequencyUtils';

let nextId = 1;
function generateId(): string {
  return `manual-${Date.now()}-${nextId++}`;
}

interface AddEntryParams {
  freq_khz: number;
  station?: string;
  demod_mode?: DemodMode;
  bandwidth?: number;
}

export function useManualEntries() {
  const [entries, setEntries] = useState<ManualEntry[]>([]);

  const add = useCallback((params: AddEntryParams): ManualEntry => {
    const demod = params.demod_mode ?? deriveDemodFromFreq(params.freq_khz);
    const bw = params.bandwidth ?? bandwidthForMode(demod);

    const entry: ManualEntry = {
      id: generateId(),
      freq_khz: params.freq_khz,
      freq_hz: Math.round(params.freq_khz * 1000),
      station: params.station || `Manual @ ${params.freq_khz} kHz`,
      demod_mode: demod,
      bandwidth: bw,
      added_at: new Date().toISOString(),
    };

    setEntries(prev => [entry, ...prev]);
    return entry;
  }, []);

  const remove = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
  }, []);

  const toBroadcast = useCallback((entry: ManualEntry) => {
    return createSyntheticBroadcast(
      entry.freq_khz,
      entry.station,
      entry.demod_mode,
      entry.bandwidth,
    );
  }, []);

  return { entries, add, remove, clear, toBroadcast };
}
