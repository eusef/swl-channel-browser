import { useState } from 'react';
import { SDRControlWritable } from '../hooks/useSDRControls';

function ReadOnlyBadge() {
  return (
    <span className="text-[10px] text-amber-400/80 ml-1" title="SDRconnect did not accept this change">
      (read-only)
    </span>
  );
}

interface SpectrumControlPanelProps {
  spectrumRefLevel: number;
  spectrumBase: number;
  connected: boolean;
  writable: SDRControlWritable;
  onSpectrumRefLevelChange: (val: number) => void;
  onSpectrumBaseChange: (val: number) => void;
}

export default function SpectrumControlPanel({
  spectrumRefLevel,
  spectrumBase,
  connected,
  writable,
  onSpectrumRefLevelChange,
  onSpectrumBaseChange,
}: SpectrumControlPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!connected) return null;

  return (
    <div className="bg-slate-800/60 border-b border-slate-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors min-h-[36px]"
      >
        <span className="flex items-center gap-2">
          <span>Spectrum</span>
          <span className="text-slate-600">
            Ref {spectrumRefLevel} dB | Base {spectrumBase} dB
          </span>
        </span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          {/* Reference Level */}
          <div className={writable.spectrumRefLevel === false ? 'opacity-50' : ''}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">
                Reference Level
                {writable.spectrumRefLevel === false && <ReadOnlyBadge />}
              </label>
              <span className="text-xs font-mono text-slate-300">{spectrumRefLevel} dB</span>
            </div>
            <input
              type="range"
              min={-40}
              max={20}
              step={1}
              value={spectrumRefLevel}
              onChange={(e) => onSpectrumRefLevelChange(parseInt(e.target.value))}
              disabled={writable.spectrumRefLevel === false}
              className="w-full h-2 accent-blue-500 disabled:opacity-30"
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
              <span>-40 dB</span>
              <span>20 dB</span>
            </div>
          </div>

          {/* Base Level */}
          <div className={writable.spectrumBase === false ? 'opacity-50' : ''}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">
                Base Level
                {writable.spectrumBase === false && <ReadOnlyBadge />}
              </label>
              <span className="text-xs font-mono text-slate-300">{spectrumBase} dB</span>
            </div>
            <input
              type="range"
              min={-160}
              max={-60}
              step={1}
              value={spectrumBase}
              onChange={(e) => onSpectrumBaseChange(parseInt(e.target.value))}
              disabled={writable.spectrumBase === false}
              className="w-full h-2 accent-blue-500 disabled:opacity-30"
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
              <span>-160 dB</span>
              <span>-60 dB</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
