export const ZOOM_PRESETS = [
  { label: '2M', hz: 2_000_000 },
  { label: '1M', hz: 1_000_000 },
  { label: '500k', hz: 500_000 },
  { label: '200k', hz: 200_000 },
  { label: '100k', hz: 100_000 },
  { label: '50k', hz: 50_000 },
] as const;

/** Find the nearest preset to a given span (optionally capped by maxHz) */
export function nearestPreset(hz: number, maxHz?: number): number {
  const presets = maxHz
    ? ZOOM_PRESETS.filter(p => p.hz <= maxHz)
    : [...ZOOM_PRESETS];
  if (presets.length === 0) return ZOOM_PRESETS[ZOOM_PRESETS.length - 1].hz;
  let best: number = presets[0].hz;
  let bestDist = Math.abs(hz - best);
  for (const p of presets) {
    const d = Math.abs(hz - p.hz);
    if (d < bestDist) {
      best = p.hz;
      bestDist = d;
    }
  }
  return best;
}

/** Step to next zoom level (negative = zoom in / narrower, positive = zoom out / wider) */
export function stepZoom(currentHz: number, direction: -1 | 1, maxHz?: number): number {
  const nearest = nearestPreset(currentHz, maxHz);
  const idx = ZOOM_PRESETS.findIndex(p => p.hz === nearest);
  // direction -1 = zoom in = higher index (smaller Hz)
  // direction +1 = zoom out = lower index (larger Hz)
  const newIdx = Math.max(0, Math.min(ZOOM_PRESETS.length - 1, idx - direction));
  const newHz = ZOOM_PRESETS[newIdx].hz;
  // Cap at max if specified
  if (maxHz && newHz > maxHz) return nearest;
  return newHz;
}

interface ZoomBarProps {
  currentZoomHz: number;
  onZoomChange: (spanHz: number) => void;
  /** Maximum zoom-out span (hardware FFT bandwidth). Presets above this are hidden. */
  maxZoomHz?: number;
}

export default function ZoomBar({ currentZoomHz, onZoomChange, maxZoomHz }: ZoomBarProps) {
  const activePreset = nearestPreset(currentZoomHz, maxZoomHz);
  const visiblePresets = maxZoomHz
    ? ZOOM_PRESETS.filter(p => p.hz <= maxZoomHz)
    : ZOOM_PRESETS;

  const maxPreset = visiblePresets.length > 0 ? visiblePresets[0].hz : ZOOM_PRESETS[0].hz;
  const minPreset = visiblePresets.length > 0 ? visiblePresets[visiblePresets.length - 1].hz : ZOOM_PRESETS[ZOOM_PRESETS.length - 1].hz;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onZoomChange(stepZoom(currentZoomHz, 1, maxZoomHz))}
        disabled={activePreset >= maxPreset}
        className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold"
        title="Zoom out"
      >
        -
      </button>
      {visiblePresets.map((p) => (
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
        onClick={() => onZoomChange(stepZoom(currentZoomHz, -1, maxZoomHz))}
        disabled={activePreset <= minPreset}
        className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold"
        title="Zoom in"
      >
        +
      </button>
    </div>
  );
}
