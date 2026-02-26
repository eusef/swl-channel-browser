import { ManualEntry, Broadcast } from '../../shared/types';
import { getBand } from '../../shared/constants';

interface ManualEntryListProps {
  entries: ManualEntry[];
  tunedFreq: number | null;
  onTune: (broadcast: Broadcast) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  toBroadcast: (entry: ManualEntry) => Broadcast;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function ManualEntryList({ entries, tunedFreq, onTune, onRemove, onClear, toBroadcast }: ManualEntryListProps) {
  if (entries.length === 0) return null;

  return (
    <div className="border-b border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-800/60">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          Manual Entries ({entries.length})
        </span>
        <button
          onClick={onClear}
          className="text-xs text-slate-500 hover:text-red-400 active:text-red-300 transition-colors min-h-[32px] px-2"
        >
          Clear all
        </button>
      </div>

      {/* Desktop table rows */}
      <div className="hidden md:block">
        <table className="w-full">
          <tbody>
            {entries.map(entry => {
              const isTuned = entry.freq_khz === tunedFreq;
              return (
                <tr
                  key={entry.id}
                  onClick={() => onTune(toBroadcast(entry))}
                  className={`cursor-pointer border-b border-slate-700/50 transition-colors
                    ${isTuned
                      ? 'bg-blue-900/30 hover:bg-blue-900/40'
                      : 'bg-slate-800/30 hover:bg-slate-700/40'
                    }`}
                >
                  <td className="px-1 py-2 w-10 text-center">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400" title="Manual entry" />
                  </td>
                  <td className="px-3 py-2 text-sm font-mono text-amber-300">{entry.freq_khz}</td>
                  <td className="px-3 py-2 text-sm text-slate-200">{entry.station}</td>
                  <td className="px-3 py-2 text-sm text-slate-400">{entry.demod_mode}</td>
                  <td className="px-3 py-2 text-sm text-slate-500 hidden lg:table-cell">
                    <span className="inline-block bg-amber-500/20 text-amber-300 text-xs px-1.5 py-0.5 rounded">
                      Manual
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-500">{formatTime(entry.added_at)}</td>
                  <td className="px-3 py-2 text-sm text-slate-500">
                    {getBand(entry.freq_khz) !== 'OOB' ? getBand(entry.freq_khz) : '-'}
                  </td>
                  <td className="px-2 py-2">
                    <button
                      onClick={e => { e.stopPropagation(); onRemove(entry.id); }}
                      className="text-slate-500 hover:text-red-400 active:text-red-300 p-1 min-h-[32px] min-w-[32px] flex items-center justify-center"
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {entries.map(entry => {
          const isTuned = entry.freq_khz === tunedFreq;
          return (
            <div
              key={entry.id}
              onClick={() => onTune(toBroadcast(entry))}
              className={`flex items-center gap-3 px-4 py-3 border-b border-slate-700/50 cursor-pointer transition-colors min-h-[56px]
                ${isTuned
                  ? 'bg-blue-900/30 active:bg-blue-900/40'
                  : 'bg-slate-800/30 active:bg-slate-700/40'
                }`}
            >
              {/* Indicator dot */}
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-amber-300">{entry.freq_khz} kHz</span>
                  <span className="text-xs text-slate-500">{entry.demod_mode}</span>
                  <span className="inline-block bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded">
                    Manual
                  </span>
                </div>
                <div className="text-xs text-slate-400 truncate mt-0.5">
                  {entry.station}
                  <span className="text-slate-600 ml-2">{formatTime(entry.added_at)}</span>
                </div>
              </div>

              {/* Delete button */}
              <button
                onClick={e => { e.stopPropagation(); onRemove(entry.id); }}
                className="text-slate-500 hover:text-red-400 active:text-red-300 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                title="Remove"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
