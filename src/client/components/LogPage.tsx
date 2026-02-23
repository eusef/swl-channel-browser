import { useState } from 'react';
import { Broadcast, ReceptionLogEntry } from '../../shared/types';
import { getLanguageName, getTargetName } from '../../shared/constants';
import LogEntryForm from './LogEntryForm';
import RecordingsList from './RecordingsList';
import { Recording } from '../hooks/useRecording';

interface LogPageProps {
  entries: ReceptionLogEntry[];
  loading: boolean;
  tunedBroadcast: Broadcast | null;
  power: number | null;
  snr: number | null;
  recordings: Recording[];
  onAdd: (data: Omit<ReceptionLogEntry, 'id' | 'logged_at'>) => void;
  onRemove: (id: string) => void;
  onExportCsv: () => void;
  onDownloadRecording: (id: string) => void;
  onDownloadRecordingWav: (id: string) => void;
  onRemoveRecording: (id: string) => void;
}

export default function LogPage({
  entries,
  loading,
  tunedBroadcast,
  power,
  snr,
  recordings,
  onAdd,
  onRemove,
  onExportCsv,
  onDownloadRecording,
  onDownloadRecordingWav,
  onRemoveRecording,
}: LogPageProps) {
  const [showForm, setShowForm] = useState(false);

  function handleSave(data: Omit<ReceptionLogEntry, 'id' | 'logged_at'>) {
    onAdd(data);
    setShowForm(false);
  }

  function formatTimestamp(iso: string): string {
    const d = new Date(iso);
    return d.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
  }

  return (
    <div className="overflow-auto flex-1 p-4 space-y-4">
      {/* Recordings section */}
      <RecordingsList
        recordings={recordings}
        onDownload={onDownloadRecording}
        onDownloadWav={onDownloadRecordingWav}
        onRemove={onRemoveRecording}
      />

      {/* Actions bar */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-200">Reception Log</h2>
        <div className="flex gap-2">
          {entries.length > 0 && (
            <button
              onClick={onExportCsv}
              className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-medium transition-colors"
            >
              Export CSV
            </button>
          )}
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors"
          >
            {showForm ? 'Close' : 'Log Station'}
          </button>
        </div>
      </div>

      {/* Log entry form */}
      {showForm && (
        <LogEntryForm
          broadcast={tunedBroadcast}
          power={power}
          snr={snr}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Log entries */}
      {loading ? (
        <div className="text-slate-500 text-sm text-center py-4">Loading log...</div>
      ) : entries.length === 0 ? (
        <div className="text-slate-500 text-sm text-center py-8">
          <p>No log entries yet</p>
          <p className="text-xs text-slate-600 mt-1">Tune to a station and tap "Log Station" to record a reception</p>
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="border-b border-slate-800 py-3 flex items-start gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-slate-200">{entry.freq_khz} kHz</span>
                  <span className="text-sm text-slate-300">{entry.station}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 flex-wrap">
                  <span>{formatTimestamp(entry.logged_at)}</span>
                  <span>|</span>
                  <span>{getLanguageName(entry.language)}</span>
                  {entry.target && (
                    <>
                      <span>|</span>
                      <span>{getTargetName(entry.target)}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  {entry.signal_power !== null && (
                    <span className="text-slate-400">{entry.signal_power} dBm</span>
                  )}
                  {entry.signal_snr !== null && (
                    <span className="text-slate-400">SNR {entry.signal_snr} dB</span>
                  )}
                </div>
                {entry.notes && (
                  <p className="text-xs text-slate-400 mt-1 italic">{entry.notes}</p>
                )}
              </div>
              <button
                onClick={() => onRemove(entry.id)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:text-red-400 transition-colors shrink-0"
                aria-label="Delete log entry"
              >
                &#10005;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
