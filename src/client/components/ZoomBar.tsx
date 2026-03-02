export const ZOOM_PRESETS = [
  { label: '2M', hz: 2_000_000 },
  { label: '1M', hz: 1_000_000 },
  { label: '500k', hz: 500_000 },
  { label: '200k', hz: 200_000 },
  { label: '100k', hz: 100_000 },
  { label: '50k', hz: 50_000 },
] as const;

/** Find the nearest preset to a given sample rate */
export function nearestPreset(hz: number): number {
  let best: number = ZOOM_PRESETS[0].hz;
  let bestDist = Math.abs(hz - best);
  for (const p of ZOOM_PRESETS) {
    const d = Math.abs(hz - p.hz);
    if (d < bestDist) {
      best = p.hz;
      bestDist = d;
    }
  }
  return best;
}

/** Step to next zoom level (negative = zoom in / narrower, positive = zoom out / wider) */
export function stepZoom(currentHz: number, direction: -1 | 1): number {
  const nearest = nearestPreset(currentHz);
  const idx = ZOOM_PRESETS.findIndex(p => p.hz === nearest);
  // direction -1 = zoom in = higher index (smaller Hz)
  // direction +1 = zoom out = lower index (larger Hz)
  const newIdx = Math.max(0, Math.min(ZOOM_PRESETS.length - 1, idx - direction));
  return ZOOM_PRESETS[newIdx].hz;
}

interface ZoomBarProps {
  currentZoomHz: number;
  onZoomChange: (sampleRateHz: number) => void;
}

export default function ZoomBar({ currentZoomHz, onZoomChange }: ZoomBarProps) {
  const activePreset = nearestPreset(currentZoomHz);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onZoomChange(stepZoom(currentZoomHz, 1))}
        disabled={activePreset >= ZOOM_PRESETS[0].hz}
        className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold"
        title="Zoom out"
      >
        -
      </button>
      {ZOOM_PRESETS.map((p) => (
        <button
          key={p.hz}
          onClick={() => onZoomChange(p.hz)}
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
            activePreset === p.hz
              ? 'bg-blue-600 text-white'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
          }`}
        >
          {p.label}
        </button>
      ))}
      <button
        onClick={() => onZoomChange(stepZoom(currentZoomHz, -1))}
        disabled={activePreset <= ZOOM_PRESETS[ZOOM_PRESETS.length - 1].hz}
        className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold"
        title="Zoom in"
      >
        +
      </button>
    </div>
  );
}
