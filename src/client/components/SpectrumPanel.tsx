import { useState, useEffect } from 'react';
import SpectrumDisplay from './SpectrumDisplay';
import WaterfallDisplay from './WaterfallDisplay';

const STORAGE_KEY = 'swl-spectrum-expanded';

interface SpectrumPanelProps {
  binsRef: React.RefObject<Uint8Array | null>;
  frameCountRef: React.RefObject<number>;
  peakShiftRef: React.RefObject<number>;
  tunedFreqKhz: number | null;
  /** Called when the panel is expanded/collapsed so parent can enable/disable streaming */
  onExpandedChange: (expanded: boolean) => void;
}

export default function SpectrumPanel({
  binsRef,
  frameCountRef,
  peakShiftRef,
  tunedFreqKhz,
  onExpandedChange,
}: SpectrumPanelProps) {
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Persist expanded state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(expanded));
    } catch { /* ignore */ }
  }, [expanded]);

  // Notify parent of expanded state changes
  useEffect(() => {
    onExpandedChange(expanded);
  }, [expanded, onExpandedChange]);

  // Don't render anything if no station is tuned
  if (tunedFreqKhz === null) return null;

  return (
    <div className="border-b border-slate-700">
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors bg-slate-800/50"
      >
        <span className="font-medium">Spectrum</span>
        <span className="text-[10px]">{expanded ? '▾' : '▸'}</span>
      </button>

      {/* Spectrum + Waterfall canvases */}
      {expanded && (
        <div className="px-2 pb-2" style={{ touchAction: 'none', overscrollBehavior: 'contain' }}>
          <SpectrumDisplay
            binsRef={binsRef}
            frameCountRef={frameCountRef}
            peakShiftRef={peakShiftRef}
            visible={expanded}
          />
          <WaterfallDisplay
            binsRef={binsRef}
            frameCountRef={frameCountRef}
            peakShiftRef={peakShiftRef}
            visible={expanded}
          />
        </div>
      )}
    </div>
  );
}
