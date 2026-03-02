import { useState } from 'react';
import { Broadcast, LogSource } from '../../shared/types';

export const SOURCE_LABELS: Record<LogSource, { label: string; color: string }> = {
  schedule: { label: 'Schedule', color: 'bg-blue-600/20 text-blue-400' },
  manual: { label: 'Manual', color: 'bg-green-600/20 text-green-400' },
  waterfall: { label: 'Waterfall', color: 'bg-amber-600/20 text-amber-400' },
  unknown: { label: 'Unknown', color: 'bg-slate-600/20 text-slate-400' },
};

interface LogEntryFormProps {
  broadcast: Broadcast | null;
  power: number | null;
  snr: number | null;
  source: LogSource;
  onSave: (data: {
    freq_khz: number;
    station: string;
    language: string;
    target: string;
    signal_power: number | null;
    signal_snr: number | null;
    notes: string;
    source: LogSource;
  }) => void;
  onCancel: () => void;
}

export default function LogEntryForm({ broadcast, power, snr, source, onSave, onCancel }: LogEntryFormProps) {
  const [notes, setNotes] = useState('');
  const [stationName, setStationName] = useState('');
  const [stationEdited, setStationEdited] = useState(false);

  if (!broadcast) {
    return (
      <div className="p-4 text-slate-500 text-sm">
        Tune to a station first to log a reception.
      </div>
    );
  }

  const effectiveStation = stationEdited ? stationName : (broadcast.station || '');

  const handleSubmit = () => {
    onSave({
      freq_khz: broadcast.freq_khz,
      station: effectiveStation,
      language: broadcast.language,
      target: broadcast.target,
      signal_power: power,
      signal_snr: snr,
      notes,
      source,
    });
    setNotes('');
    setStationName('');
    setStationEdited(false);
  };

  const srcInfo = SOURCE_LABELS[source];

  return (
    <div className="border border-slate-700 rounded-lg bg-slate-800/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Log Reception</h3>
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${srcInfo.color}`}>
          {srcInfo.label}
        </span>
      </div>
      <div className="text-xs text-slate-400 space-y-2">
        <div className="flex gap-2 items-center">
          <span className="font-mono font-bold text-slate-300">{broadcast.freq_khz} kHz</span>
          {broadcast.station ? (
            <span>{broadcast.station}</span>
          ) : (
            <input
              type="text"
              value={stationEdited ? stationName : ''}
              onChange={(e) => { setStationName(e.target.value); setStationEdited(true); }}
              placeholder="Station name (optional)"
              className="flex-1 bg-slate-700 text-slate-200 rounded px-2 py-1 text-xs border border-slate-600 placeholder:text-slate-500"
            />
          )}
        </div>
        <div className="flex gap-3">
          {power !== null && <span>Signal: {power} dBm</span>}
          {snr !== null && <span>SNR: {snr} dB</span>}
          {power === null && snr === null && <span className="text-slate-500">No signal data</span>}
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional) - e.g., reception quality, conditions..."
        className="w-full bg-slate-700 text-slate-200 rounded px-3 py-2 text-sm border border-slate-600 placeholder:text-slate-500 min-h-[60px] resize-y"
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors"
        >
          Save Entry
        </button>
      </div>
    </div>
  );
}
