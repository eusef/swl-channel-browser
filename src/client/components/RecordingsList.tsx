import { Recording } from '../hooks/useRecording';

interface RecordingsListProps {
  recordings: Recording[];
  onDownload: (id: string) => void;
  onDownloadWav: (id: string) => void;
  onRemove: (id: string) => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
}

export default function RecordingsList({
  recordings,
  onDownload,
  onDownloadWav,
  onRemove,
}: RecordingsListProps) {
  if (recordings.length === 0) return null;

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-slate-200 mb-2">
        Recordings ({recordings.length})
      </h3>
      <p className="text-xs text-slate-500 mb-3">
        In-memory only - recordings are lost on page refresh
      </p>
      {recordings.map((rec) => (
        <div
          key={rec.id}
          className="border-b border-slate-800 py-3 flex items-start gap-3"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-slate-200">
                {rec.freq_khz} kHz
              </span>
              <span className="text-sm text-slate-300">{rec.station}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
              <span>{formatTimestamp(rec.started_at)}</span>
              <span>|</span>
              <span>{formatDuration(rec.duration_seconds)}</span>
            </div>
            <div className="text-xs text-slate-600 mt-0.5 truncate">
              {rec.filename}
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => onDownload(rec.id)}
              className="min-h-[44px] px-2 flex items-center justify-center text-xs text-blue-400 hover:text-blue-300 transition-colors"
              aria-label="Download as WebM"
              title="Download WebM"
            >
              WebM
            </button>
            <button
              onClick={() => onDownloadWav(rec.id)}
              className="min-h-[44px] px-2 flex items-center justify-center text-xs text-blue-400 hover:text-blue-300 transition-colors"
              aria-label="Download as WAV"
              title="Convert and download as WAV"
            >
              WAV
            </button>
            <button
              onClick={() => onRemove(rec.id)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:text-red-400 transition-colors"
              aria-label="Remove recording"
              title="Remove"
            >
              &#10005;
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
