import { useState } from 'react';
import { FiltersResponse } from '../../shared/types';

interface FilterBarProps {
  available: FiltersResponse;
  band?: string;
  lang?: string;
  target?: string;
  q?: string;
  onFilterChange: (key: string, value: string | undefined) => void;
  onClear: () => void;
}

export default function FilterBar({ available, band, lang, target, q, onFilterChange, onClear }: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const hasFilters = band || lang || target || q;

  return (
    <div className="bg-slate-800/50 border-b border-slate-700 px-4 py-2">
      {/* Mobile toggle */}
      <div className="sm:hidden flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="min-h-[44px] text-sm text-slate-400 flex items-center gap-2 px-1"
        >
          <span>Filters</span>
          {hasFilters && <span className="w-2 h-2 rounded-full bg-blue-500" />}
          <span className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {hasFilters && (
          <button
            onClick={onClear}
            className="min-h-[44px] px-3 text-sm text-slate-500 hover:text-slate-300 active:text-slate-100"
          >
            Clear
          </button>
        )}
      </div>

      {/* Filter controls */}
      <div className={`${expanded ? 'mt-2' : 'hidden'} sm:flex sm:items-center sm:gap-3 flex flex-col sm:flex-row gap-2`}>
        <select
          value={band || ''}
          onChange={(e) => onFilterChange('band', e.target.value || undefined)}
          className="bg-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 sm:px-2 sm:py-1.5 border border-slate-600 w-full sm:w-auto"
        >
          <option value="">All Bands</option>
          {available.bands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <select
          value={lang || ''}
          onChange={(e) => onFilterChange('lang', e.target.value || undefined)}
          className="bg-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 sm:px-2 sm:py-1.5 border border-slate-600 w-full sm:w-auto"
        >
          <option value="">All Languages</option>
          {available.languages.map((l) => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </select>

        <select
          value={target || ''}
          onChange={(e) => onFilterChange('target', e.target.value || undefined)}
          className="bg-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 sm:px-2 sm:py-1.5 border border-slate-600 w-full sm:w-auto"
        >
          <option value="">All Targets</option>
          {available.targets.map((t) => (
            <option key={t.code} value={t.code}>{t.name}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search station or freq..."
          value={q || ''}
          onChange={(e) => onFilterChange('q', e.target.value || undefined)}
          className="bg-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 sm:px-2 sm:py-1.5 border border-slate-600 placeholder:text-slate-500 w-full sm:flex-1 sm:min-w-0"
        />

        {hasFilters && (
          <button
            onClick={onClear}
            className="hidden sm:block text-sm text-slate-500 hover:text-slate-300 px-2 min-h-[44px]"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
