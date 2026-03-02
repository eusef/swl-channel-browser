import { useEffect, useRef } from 'react';
import { stepZoom } from '../components/ZoomBar';

const DEBOUNCE_MS = 200;

interface KeyboardShortcutOptions {
  /** Whether shortcuts are active (e.g. broadcast is tuned) */
  active: boolean;
  /** Current frequency step size in Hz */
  stepHz: number;
  /** Current zoom (sample rate) in Hz */
  currentZoomHz: number;
  /** Callback for frequency adjustment */
  onFrequencyAdjust: (deltaHz: number) => void;
  /** Callback for zoom change */
  onZoomChange: (sampleRateHz: number) => void;
}

/**
 * Global keyboard shortcuts:
 * - Left/Right arrow: adjust frequency by step size
 * - +/= key: zoom in (narrower span)
 * - -/_ key: zoom out (wider span)
 */
export function useKeyboardShortcuts({
  active,
  stepHz,
  currentZoomHz,
  onFrequencyAdjust,
  onZoomChange,
}: KeyboardShortcutOptions) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep current values in refs so the event listener always sees latest
  const stepHzRef = useRef(stepHz);
  const zoomHzRef = useRef(currentZoomHz);
  const onFreqRef = useRef(onFrequencyAdjust);
  const onZoomRef = useRef(onZoomChange);

  stepHzRef.current = stepHz;
  zoomHzRef.current = currentZoomHz;
  onFreqRef.current = onFrequencyAdjust;
  onZoomRef.current = onZoomChange;

  useEffect(() => {
    if (!active) return;

    const handler = (e: KeyboardEvent) => {
      // Skip when focus is in an input element
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      let action: (() => void) | null = null;

      switch (e.key) {
        case 'ArrowLeft':
          action = () => onFreqRef.current(-stepHzRef.current);
          break;
        case 'ArrowRight':
          action = () => onFreqRef.current(stepHzRef.current);
          break;
        case '=':
        case '+':
          action = () => onZoomRef.current(stepZoom(zoomHzRef.current, -1));
          break;
        case '-':
        case '_':
          action = () => onZoomRef.current(stepZoom(zoomHzRef.current, 1));
          break;
        default:
          return;
      }

      e.preventDefault();

      // Debounce
      if (debounceRef.current) return;
      action();
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
      }, DEBOUNCE_MS);
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [active]);
}
