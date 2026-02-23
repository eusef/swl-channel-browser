import { useState } from 'react';
import { Broadcast } from '../../shared/types';

interface LogEntryFormProps {
  broadcast: Broadcast | null;
  power: number | null;
  snr: number | null;
  onSave: (data: {
    freq_khz: number;
    station: string;
    language: string;
    target: string;
    signal_power: number | null;
    signal_snr: number | null;
    notes: string;
  }) => void;
  onCancel: () => void;
}

export default function LogEntryForm({ broadcast, power, snr, onSave, onCancel }: LogEntryFormProps) {
  const [notes, setNotes] = useState('');

  if (!broadcast) {
    return (
      <div className="p-4 text-slate-500 text-sm">
        Tune to a station first to log a reception.
      </div>
    );
  }

  const handleSubmit = () => {
    onSave({
      freq_khz: broadcast.freq_khz,
      station: broadcast.station,
      language: broadcast.language,
      target: broadcast.target,
      signal_power: power,
      signal_snr: snr,
      notes,
    });
    setNotes('');
  };

  return (
    <div className="border border-slate-700 rounded-lg bg-slate-800/50 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-200">Log Reception</h3>
      <div className="text-xs text-slate-400 space-y-1">
        <div className="flex gap-2">
          <span className="font-mono font-bold text-slate-300">{broadcast.freq_khz} kHz</span>
          <span>{broadcast.station}</span>
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
