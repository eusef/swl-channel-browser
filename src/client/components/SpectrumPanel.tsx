import { useState, useEffect, useRef, useCallback } from 'react';
import { Broadcast } from '../../shared/types';
import SpectrumDisplay from './SpectrumDisplay';
import WaterfallDisplay from './WaterfallDisplay';

const STORAGE_KEY = 'swl-spectrum-expanded';

interface SpectrumPanelProps {
  binsRef: React.RefObject<Uint8Array | null>;
  frameCountRef: React.RefObject<number>;
  peakShiftRef: React.RefObject<number>;
  tunedFreqKhz: number | null;
  /** Device center frequency in Hz (true center of spectrum span) */
  centerFreqHz: number | null;
  /** Spectrum span in Hz (from device_sample_rate, defaults to 1 MHz) */
  spanHz?: number | null;
  /** VFO frequency in Hz (where the radio is tuned) */
  vfoFreqHz: number | null;
  nearbyBroadcasts?: Broadcast[];
  onExpandedChange: (expanded: boolean) => void;
  onTuneToFreq?: (freqHz: number) => void;
  onDragEnd?: (deltaHz: number) => void;
}

export default function SpectrumPanel({
  binsRef,
  frameCountRef,
  peakShiftRef,
  tunedFreqKhz,
  centerFreqHz,
  spanHz,
  vfoFreqHz,
  nearbyBroadcasts = [],
  onExpandedChange,
  onTuneToFreq,
  onDragEnd,
}: SpectrumPanelProps) {
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Shared drag offset (in pixels) so both displays pan together
  const sharedDragOffsetRef = useRef(0);

  // Force re-render of both displays when drag offset changes
  const [, setDragTick] = useState(0);
  const updateDragOffset = useCallback((px: number) => {
    sharedDragOffsetRef.current = px;
    setDragTick(t => t + 1);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(expanded));
    } catch { /* ignore */ }
  }, [expanded]);

  useEffect(() => {
    onExpandedChange(expanded);
  }, [expanded, onExpandedChange]);

  if (tunedFreqKhz === null) return null;

  return (
    <div className="border-b border-slate-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors bg-slate-800/50"
      >
        <span className="font-medium">Spectrum</span>
        <span className="text-[10px]">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="px-2 pb-2" style={{ touchAction: 'none', overscrollBehavior: 'contain' }}>
          <SpectrumDisplay
            binsRef={binsRef}
            frameCountRef={frameCountRef}
            peakShiftRef={peakShiftRef}
            visible={expanded}
            centerFreqHz={centerFreqHz}
            spanHz={spanHz}
            vfoFreqHz={vfoFreqHz}
            nearbyBroadcasts={nearbyBroadcasts}
            onTuneToFreq={onTuneToFreq}
            onDragEnd={onDragEnd}
            sharedDragOffsetRef={sharedDragOffsetRef}
            onDragOffsetChange={updateDragOffset}
          />
          <WaterfallDisplay
            binsRef={binsRef}
            frameCountRef={frameCountRef}
            peakShiftRef={peakShiftRef}
            visible={expanded}
            centerFreqHz={centerFreqHz}
            spanHz={spanHz}
            vfoFreqHz={vfoFreqHz}
            onTuneToFreq={onTuneToFreq}
            onDragEnd={onDragEnd}
            sharedDragOffsetRef={sharedDragOffsetRef}
            onDragOffsetChange={updateDragOffset}
          />
        </div>
      )}
    </div>
  );
}
