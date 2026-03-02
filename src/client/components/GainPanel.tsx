import { useState } from 'react';
import { SDRControlWritable } from '../hooks/useSDRControls';

/** Small "read-only" badge shown next to controls the server rejected */
function ReadOnlyBadge() {
  return (
    <span className="text-[10px] text-amber-400/80 ml-1" title="SDRconnect did not accept this change">
      (read-only)
    </span>
  );
}

interface GainPanelProps {
  lnaState: number;
  lnaMin: number;
  lnaMax: number;
  agcEnabled: boolean;
  agcThreshold: number;
  overload: boolean;
  connected: boolean;
  writable: SDRControlWritable;
  onLNAChange: (val: number) => void;
  onAGCChange: (enabled: boolean) => void;
  onAGCThresholdChange: (val: number) => void;
}

export default function GainPanel({
  lnaState,
  lnaMin,
  lnaMax,
  agcEnabled,
  agcThreshold,
  overload,
  connected,
  writable,
  onLNAChange,
  onAGCChange,
  onAGCThresholdChange,
}: GainPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!connected) return null;

  return (
    <div className="bg-slate-800/60 border-b border-slate-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors min-h-[36px]"
      >
        <span className="flex items-center gap-2">
          <span>Gain</span>
          <span className="text-slate-600">
            LNA {lnaState} | AGC {agcEnabled ? 'On' : 'Off'}
            {agcEnabled && ` (${agcThreshold})`}
            {overload && <span className="text-red-400 font-medium ml-1">OVERLOAD</span>}
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
          {/* LNA State (RF gain) */}
          <div className={writable.lna === false ? 'opacity-50' : ''}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">
                LNA State
                {writable.lna === false && <ReadOnlyBadge />}
              </label>
              <span className="text-xs font-mono text-slate-300">{lnaState}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onLNAChange(Math.max(lnaMin, lnaState - 1))}
                disabled={lnaState <= lnaMin || writable.lna === false}
                className="w-8 h-8 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-slate-300 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >
                -
              </button>
              <input
                type="range"
                min={lnaMin}
                max={lnaMax}
                step={1}
                value={lnaState}
                onChange={(e) => onLNAChange(parseInt(e.target.value))}
                disabled={writable.lna === false}
                className="flex-1 h-2 accent-blue-500 disabled:opacity-30"
              />
              <button
                onClick={() => onLNAChange(Math.min(lnaMax, lnaState + 1))}
                disabled={lnaState >= lnaMax || writable.lna === false}
                className="w-8 h-8 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-slate-300 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
            <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
              <span>{lnaMin}</span>
              <span>{lnaMax}</span>
            </div>
          </div>

          {/* AGC Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-400">
              AGC
              {writable.agc === false && <ReadOnlyBadge />}
            </label>
            <button
              onClick={() => onAGCChange(!agcEnabled)}
              disabled={writable.agc === false}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                agcEnabled ? 'bg-blue-600' : 'bg-slate-600'
              } ${writable.agc === false ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  agcEnabled ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {/* AGC Threshold (visible when AGC on) */}
          {agcEnabled && (
            <div className={writable.agcThreshold === false ? 'opacity-50' : ''}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">
                  AGC Threshold
                  {writable.agcThreshold === false && <ReadOnlyBadge />}
                </label>
                <span className="text-xs font-mono text-slate-300">{agcThreshold} dB</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={agcThreshold}
                onChange={(e) => onAGCThresholdChange(parseInt(e.target.value))}
                disabled={writable.agcThreshold === false}
                className="w-full h-2 accent-blue-500 disabled:opacity-30"
              />
              <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                <span>0 dB</span>
                <span>100 dB</span>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
