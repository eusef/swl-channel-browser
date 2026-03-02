import { useState } from 'react';
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

interface AudioPanelProps {
  audioMute: boolean;
  audioLimiters: boolean;
  squelchEnable: boolean;
  squelchThreshold: number;
  nrEnable: boolean;
  nrStrength: number;
  connected: boolean;
  writable: SDRControlWritable;
  onAudioMuteChange: (val: boolean) => void;
  onAudioLimitersChange: (val: boolean) => void;
  onSquelchEnableChange: (val: boolean) => void;
  onSquelchThresholdChange: (val: number) => void;
  onNREnableChange: (val: boolean) => void;
  onNRStrengthChange: (val: number) => void;
}

export default function AudioPanel({
  audioMute,
  audioLimiters,
  squelchEnable,
  squelchThreshold,
  nrEnable,
  nrStrength,
  connected,
  writable,
  onAudioMuteChange,
  onAudioLimitersChange,
  onSquelchEnableChange,
  onSquelchThresholdChange,
  onNREnableChange,
  onNRStrengthChange,
}: AudioPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!connected) return null;

  return (
    <div className="bg-slate-800/60 border-b border-slate-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors min-h-[36px]"
      >
        <span className="flex items-center gap-2">
          <span>Audio</span>
          <span className="text-slate-600">
            {audioMute ? 'Muted' : 'Unmuted'}
            {' | SQ '}
            {squelchEnable ? 'On' : 'Off'}
            {' | NR '}
            {nrEnable ? `On (${nrStrength})` : 'Off'}
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
          {/* SDR Mute */}
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-400">
              SDR Mute
              {writable.audioMute === false && <ReadOnlyBadge />}
            </label>
            <Toggle
              enabled={audioMute}
              disabled={writable.audioMute === false}
              onChange={onAudioMuteChange}
            />
          </div>

          {/* Audio Limiters */}
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-400">
              Audio Limiters
              {writable.audioLimiters === false && <ReadOnlyBadge />}
            </label>
            <Toggle
              enabled={audioLimiters}
              disabled={writable.audioLimiters === false}
              onChange={onAudioLimitersChange}
            />
          </div>

          {/* Squelch Enable */}
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-400">
              Squelch
              {writable.squelchEnable === false && <ReadOnlyBadge />}
            </label>
            <Toggle
              enabled={squelchEnable}
              disabled={writable.squelchEnable === false}
              onChange={onSquelchEnableChange}
            />
          </div>

          {/* Squelch Threshold (visible when squelch on) */}
          {squelchEnable && (
            <div className={writable.squelchThreshold === false ? 'opacity-50' : ''}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">
                  Squelch Threshold
                  {writable.squelchThreshold === false && <ReadOnlyBadge />}
                </label>
                <span className="text-xs font-mono text-slate-300">{squelchThreshold} dBm</span>
              </div>
              <input
                type="range"
                min={-150}
                max={0}
                step={1}
                value={squelchThreshold}
                onChange={(e) => onSquelchThresholdChange(parseInt(e.target.value))}
                disabled={writable.squelchThreshold === false}
                className="w-full h-2 accent-blue-500 disabled:opacity-30"
              />
              <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                <span>-150 dBm</span>
                <span>0 dBm</span>
              </div>
            </div>
          )}

          {/* Noise Reduction Enable */}
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-400">
              Noise Reduction
              {writable.nrEnable === false && <ReadOnlyBadge />}
            </label>
            <Toggle
              enabled={nrEnable}
              disabled={writable.nrEnable === false}
              onChange={onNREnableChange}
            />
          </div>

          {/* NR Strength (visible when NR on) */}
          {nrEnable && (
            <div className={writable.nrStrength === false ? 'opacity-50' : ''}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">
                  NR Strength
                  {writable.nrStrength === false && <ReadOnlyBadge />}
                </label>
                <span className="text-xs font-mono text-slate-300">{nrStrength}</span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={nrStrength}
                onChange={(e) => onNRStrengthChange(parseInt(e.target.value))}
                disabled={writable.nrStrength === false}
                className="w-full h-2 accent-blue-500 disabled:opacity-30"
              />
              <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                <span>0</span>
                <span>10</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
