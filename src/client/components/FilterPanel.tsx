import { useState } from 'react';
import { DemodMode } from '../../shared/types';
import { SDRControlWritable } from '../hooks/useSDRControls';

function ReadOnlyBadge() {
  return (
    <span className="text-[10px] text-amber-400/80 ml-1" title="SDRconnect did not accept this change">
      (read-only)
    </span>
  );
}

function Toggle({
  enabled,
  disabled,
  onChange,
}: {
  enabled: boolean;
  disabled: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className={`relative w-10 h-5 rounded-full transition-colors ${
        enabled ? 'bg-blue-600' : 'bg-slate-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          enabled ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

interface FilterPanelProps {
  demodMode: DemodMode | null;
  wfmStereoEnable: boolean;
  rdsEnable: boolean;
  nfmDeemphasisEnable: boolean;
  amLowcut: number;
  ssbLowcut: number;
  nfmLowcut: number;
  connected: boolean;
  writable: SDRControlWritable;
  onWfmStereoEnableChange: (val: boolean) => void;
  onRdsEnableChange: (val: boolean) => void;
  onNfmDeemphasisEnableChange: (val: boolean) => void;
  onAmLowcutChange: (val: number) => void;
  onSsbLowcutChange: (val: number) => void;
  onNfmLowcutChange: (val: number) => void;
}

/** Which controls are relevant per demod mode */
function modeHas(mode: DemodMode | null) {
  return {
    wfm: mode === 'WFM',
    nfm: mode === 'NFM',
    am: mode === 'AM' || mode === 'SAM',
    ssb: mode === 'USB' || mode === 'LSB',
  };
}

export default function FilterPanel({
  demodMode,
  wfmStereoEnable,
  rdsEnable,
  nfmDeemphasisEnable,
  amLowcut,
  ssbLowcut,
  nfmLowcut,
  connected,
  writable,
  onWfmStereoEnableChange,
  onRdsEnableChange,
  onNfmDeemphasisEnableChange,
  onAmLowcutChange,
  onSsbLowcutChange,
  onNfmLowcutChange,
}: FilterPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const has = modeHas(demodMode);

  // Only show panel when there are relevant mode-specific controls
  const hasControls = has.wfm || has.nfm || has.am || has.ssb;
  if (!connected || !hasControls) return null;

  const modeLabel = demodMode || '?';

  // Build summary text
  const summaryParts: string[] = [];
  if (has.wfm) {
    summaryParts.push(wfmStereoEnable ? 'Stereo' : 'Mono');
    summaryParts.push(rdsEnable ? 'RDS On' : 'RDS Off');
  }
  if (has.nfm) {
    summaryParts.push(nfmDeemphasisEnable ? 'De-emph On' : 'De-emph Off');
    summaryParts.push(`LC ${nfmLowcut} Hz`);
  }
  if (has.am) summaryParts.push(`LC ${amLowcut} Hz`);
  if (has.ssb) summaryParts.push(`LC ${ssbLowcut} Hz`);

  return (
    <div className="bg-slate-800/60 border-b border-slate-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors min-h-[36px]"
      >
        <span className="flex items-center gap-2">
          <span>{modeLabel} Filters</span>
          <span className="text-slate-600">{summaryParts.join(' | ')}</span>
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
          {/* WFM: Stereo + RDS */}
          {has.wfm && (
            <>
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">
                  Stereo
                  {writable.wfmStereoEnable === false && <ReadOnlyBadge />}
                </label>
                <Toggle
                  enabled={wfmStereoEnable}
                  disabled={writable.wfmStereoEnable === false}
                  onChange={onWfmStereoEnableChange}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">
                  RDS Decode
                  {writable.rdsEnable === false && <ReadOnlyBadge />}
                </label>
                <Toggle
                  enabled={rdsEnable}
                  disabled={writable.rdsEnable === false}
                  onChange={onRdsEnableChange}
                />
              </div>
            </>
          )}

          {/* NFM: De-emphasis + Lowcut */}
          {has.nfm && (
            <>
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">
                  De-emphasis
                  {writable.nfmDeemphasisEnable === false && <ReadOnlyBadge />}
                </label>
                <Toggle
                  enabled={nfmDeemphasisEnable}
                  disabled={writable.nfmDeemphasisEnable === false}
                  onChange={onNfmDeemphasisEnableChange}
                />
              </div>
              <LowcutSlider
                label="Low-Cut"
                value={nfmLowcut}
                writable={writable.nfmLowcut}
                onChange={onNfmLowcutChange}
                min={0}
                max={1000}
              />
            </>
          )}

          {/* AM/SAM: Lowcut */}
          {has.am && (
            <LowcutSlider
              label="Low-Cut"
              value={amLowcut}
              writable={writable.amLowcut}
              onChange={onAmLowcutChange}
              min={0}
              max={500}
            />
          )}

          {/* SSB: Lowcut */}
          {has.ssb && (
            <LowcutSlider
              label="Low-Cut"
              value={ssbLowcut}
              writable={writable.ssbLowcut}
              onChange={onSsbLowcutChange}
              min={0}
              max={500}
            />
          )}
        </div>
      )}
    </div>
  );
}

function LowcutSlider({
  label,
  value,
  writable,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  writable: boolean | null;
  onChange: (val: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className={writable === false ? 'opacity-50' : ''}>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-slate-400">
          {label}
          {writable === false && <ReadOnlyBadge />}
        </label>
        <span className="text-xs font-mono text-slate-300">{value} Hz</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={10}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        disabled={writable === false}
        className="w-full h-2 accent-blue-500 disabled:opacity-30"
      />
      <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
        <span>{min} Hz</span>
        <span>{max} Hz</span>
      </div>
    </div>
  );
}
