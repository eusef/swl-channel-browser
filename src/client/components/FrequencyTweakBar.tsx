import { useState, useRef, useCallback, useEffect } from 'react';

const STEP_OPTIONS = [
  { label: '100Hz', hz: 100 },
  { label: '1kHz', hz: 1000 },
  { label: '5kHz', hz: 5000 },
  { label: '9kHz', hz: 9000 },
  { label: '10kHz', hz: 10000 },
] as const;

const STORAGE_KEY = 'swl-freq-step';

/** Long-press repeat interval (ms) */
const REPEAT_INTERVAL_MS = 150;

interface FrequencyTweakBarProps {
  freqHz: number | null;
  connected: boolean;
  onAdjust: (deltaHz: number) => void;
}

export default function FrequencyTweakBar({
  freqHz,
  connected,
  onAdjust,
}: FrequencyTweakBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [stepHz, setStepHz] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const n = parseInt(saved);
        if (STEP_OPTIONS.some(s => s.hz === n)) return n;
      }
    } catch { /* ignore */ }
    return 1000;
  });

  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Expose stepHz to keyboard hook via ref */
  const stepHzRef = useRef(stepHz);
  stepHzRef.current = stepHz;

  // Persist step size
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(stepHz)); } catch { /* ignore */ }
  }, [stepHz]);

  const stopRepeat = useCallback(() => {
    if (repeatTimer.current) {
      clearInterval(repeatTimer.current);
      repeatTimer.current = null;
    }
  }, []);

  const startRepeat = useCallback((delta: number) => {
    stopRepeat();
    onAdjust(delta);
    repeatTimer.current = setInterval(() => onAdjust(delta), REPEAT_INTERVAL_MS);
  }, [onAdjust, stopRepeat]);

  // Cleanup on unmount
  useEffect(() => () => stopRepeat(), [stopRepeat]);

  if (!connected || freqHz === null) return null;

  const freqKhz = freqHz / 1000;
  const freqDisplay = freqKhz >= 10000
    ? `${(freqKhz / 1000).toFixed(3)} MHz`
    : `${freqKhz.toFixed(1)} kHz`;

  return (
    <div className="bg-slate-800/60 border-b border-slate-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors min-h-[36px]"
      >
        <span className="flex items-center gap-2">
          <span>Tune</span>
          <span className="text-slate-600">
            {freqDisplay} | Step {STEP_OPTIONS.find(s => s.hz === stepHz)?.label ?? '1kHz'}
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
          {/* Frequency display + +/- buttons */}
          <div className="flex items-center gap-3">
            <button
              onPointerDown={() => startRepeat(-stepHz)}
              onPointerUp={stopRepeat}
              onPointerLeave={stopRepeat}
              onPointerCancel={stopRepeat}
              className="w-11 h-11 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-slate-200 text-lg font-bold select-none"
              title={`-${STEP_OPTIONS.find(s => s.hz === stepHz)?.label}`}
            >
              -
            </button>
            <div className="flex-1 text-center">
              <span className="text-lg font-mono font-bold text-blue-400">{freqDisplay}</span>
            </div>
            <button
              onPointerDown={() => startRepeat(stepHz)}
              onPointerUp={stopRepeat}
              onPointerLeave={stopRepeat}
              onPointerCancel={stopRepeat}
              className="w-11 h-11 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-slate-200 text-lg font-bold select-none"
              title={`+${STEP_OPTIONS.find(s => s.hz === stepHz)?.label}`}
            >
              +
            </button>
          </div>

          {/* Step size selector */}
          <div className="flex items-center gap-1.5 justify-center">
            {STEP_OPTIONS.map((opt) => (
              <button
                key={opt.hz}
                onClick={() => setStepHz(opt.hz)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors min-h-[32px] ${
                  stepHz === opt.hz
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="text-center text-[10px] text-slate-600">
            Arrow keys: Left/Right to adjust
          </div>
        </div>
      )}
    </div>
  );
}

/** Get current step size (for keyboard hook). Returns ref to current value. */
export { STEP_OPTIONS, STORAGE_KEY };
