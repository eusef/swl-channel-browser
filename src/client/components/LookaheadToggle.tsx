interface LookaheadToggleProps {
  mode: 'now' | 'upcoming';
  hours: number;
  onModeChange: (mode: 'now' | 'upcoming') => void;
  onHoursChange: (hours: number) => void;
  count: number;
}

export default function LookaheadToggle({ mode, hours, onModeChange, onHoursChange, count }: LookaheadToggleProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-slate-800/30 border-b border-slate-700 text-sm">
      <div className="flex rounded-lg overflow-hidden border border-slate-600">
        <button
          onClick={() => onModeChange('now')}
          className={`px-4 py-2 min-h-[44px] text-sm font-medium transition-colors
            ${mode === 'now' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200 active:bg-slate-600'}`}
        >
          On Now
        </button>
        <button
          onClick={() => onModeChange('upcoming')}
          className={`px-4 py-2 min-h-[44px] text-sm font-medium transition-colors
            ${mode === 'upcoming' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200 active:bg-slate-600'}`}
        >
          Coming Up
        </button>
      </div>

      {mode === 'upcoming' && (
        <div className="flex rounded-lg overflow-hidden border border-slate-600">
          {[1, 3, 6].map((h) => (
            <button
              key={h}
              onClick={() => onHoursChange(h)}
              className={`px-3 py-2 min-h-[44px] min-w-[44px] text-sm transition-colors
                ${hours === h ? 'bg-slate-600 text-white' : 'bg-slate-700 text-slate-500 hover:text-slate-300 active:bg-slate-600'}`}
            >
              {h}h
            </button>
          ))}
        </div>
      )}

      <span className="text-sm text-slate-500 ml-auto">
        {count} station{count !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
