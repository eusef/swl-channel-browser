import { useRef, useEffect, useCallback } from 'react';
import { Broadcast } from '../../shared/types';
import { formatFreqHz, DEFAULT_SPAN_HZ, getDisplayFreqRange } from '../lib/spectrumUtils';
import { stepZoom } from './ZoomBar';

interface SpectrumDisplayProps {
  binsRef: React.RefObject<Uint8Array | null>;
  frameCountRef: React.RefObject<number>;
  peakShiftRef: React.RefObject<number>;
  visible: boolean;
  centerFreqHz: number | null;
  /** Display span in Hz (zoom level, may be smaller than hardware span) */
  spanHz?: number | null;
  /** Full hardware FFT span in Hz (total bandwidth of all bins) */
  hardwareSpanHz?: number | null;
  vfoFreqHz: number | null;
  nearbyBroadcasts?: Broadcast[];
  onTuneToFreq?: (freqHz: number) => void;
  onDragEnd?: (deltaHz: number) => void;
  onZoomChange?: (spanHz: number) => void;
  sharedDragOffsetRef: React.RefObject<number>;
  onDragOffsetChange: (px: number) => void;
}

const CANVAS_HEIGHT_MOBILE = 120;
const CANVAS_HEIGHT_DESKTOP = 150;
const GRID_COLOR = 'rgba(148, 163, 184, 0.15)';
const LINE_COLOR = '#22d3ee';
const FILL_TOP = 'rgba(34, 211, 238, 0.3)';
const FILL_BOTTOM = 'rgba(15, 23, 42, 0.8)';
const VFO_MARKER_COLOR = 'rgba(96, 165, 250, 0.9)';
const BG_COLOR = '#0f172a';
const MARKER_COLOR = 'rgba(250, 204, 21, 0.7)';
const MARKER_LABEL_COLOR = 'rgba(250, 204, 21, 0.9)';
const CROSSHAIR_COLOR = 'rgba(248, 250, 252, 0.5)';
const DRAG_THRESHOLD = 6;

/** Compute visible bin range for software zoom */
function getVisibleBins(totalBins: number, spanHz: number, hardwareSpanHz: number) {
  if (spanHz >= hardwareSpanHz) return { startBin: 0, visibleCount: totalBins };
  const ratio = spanHz / hardwareSpanHz;
  const visibleCount = Math.max(2, Math.round(totalBins * ratio));
  const startBin = Math.floor((totalBins - visibleCount) / 2);
  return { startBin, visibleCount };
}

export default function SpectrumDisplay({
  binsRef,
  frameCountRef,
  peakShiftRef,
  visible,
  centerFreqHz,
  spanHz: spanHzProp,
  hardwareSpanHz: hardwareSpanHzProp,
  vfoFreqHz,
  nearbyBroadcasts = [],
  onTuneToFreq,
  onDragEnd,
  onZoomChange,
  sharedDragOffsetRef,
  onDragOffsetChange,
}: SpectrumDisplayProps) {
  const spanHz = spanHzProp ?? DEFAULT_SPAN_HZ;
  const hardwareSpanHz = hardwareSpanHzProp ?? spanHz;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef(-1);
  const lastDrawnOffsetRef = useRef(0);
  const dprRef = useRef(window.devicePixelRatio || 1);

  const pointerDownRef = useRef<{ x: number; y: number; startX: number } | null>(null);
  const isDraggingRef = useRef(false);
  const hoverXRef = useRef<number | null>(null);

  // Clickable EiBi label hit regions: { x, y, w, h, freqHz }
  const labelRectsRef = useRef<{ x: number; y: number; w: number; h: number; freqHz: number }[]>([]);

  const getCanvasHeight = useCallback(() => {
    return window.innerWidth >= 640 ? CANVAS_HEIGHT_DESKTOP : CANVAS_HEIGHT_MOBILE;
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;
    const width = container.clientWidth;
    const height = getCanvasHeight();

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    if (overlay) {
      overlay.width = width * dpr;
      overlay.height = height * dpr;
      overlay.style.width = `${width}px`;
      overlay.style.height = `${height}px`;
    }
  }, [getCanvasHeight]);

  const drawSpectrum = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = dprRef.current;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const dragPx = sharedDragOffsetRef.current ?? 0;
    const shift = peakShiftRef.current ?? 0;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = (h * i) / 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const bins = binsRef.current;
    if (!bins || bins.length === 0) return;

    const totalBins = bins.length;
    const { startBin, visibleCount } = getVisibleBins(totalBins, spanHz, hardwareSpanHz);
    const xStep = w / visibleCount;

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, FILL_TOP);
    gradient.addColorStop(1, FILL_BOTTOM);

    // Spectrum fill (only visible bins)
    // Plot each bin at the CENTER of its pixel column ((i+0.5)*xStep)
    // so the spectrum aligns with the waterfall and frequency markers.
    const halfBin = xStep / 2;
    ctx.beginPath();
    ctx.moveTo(halfBin + dragPx, h);
    for (let i = 0; i < visibleCount; i++) {
      const x = i * xStep + halfBin + dragPx;
      const amplitude = bins[startBin + i] / 255;
      const y = h - amplitude * h;
      ctx.lineTo(x, y);
    }
    ctx.lineTo((visibleCount - 1) * xStep + halfBin + dragPx, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Spectrum line (only visible bins)
    ctx.beginPath();
    for (let i = 0; i < visibleCount; i++) {
      const x = i * xStep + halfBin + dragPx;
      const amplitude = bins[startBin + i] / 255;
      const y = h - amplitude * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // EiBi markers with collision avoidance
    // Use bin-based freq range so markers align with rendered bins
    const newLabelRects: typeof labelRectsRef.current = [];
    if (centerFreqHz && nearbyBroadcasts.length > 0) {
      const { displayStartFreqHz, displaySpanHz } = getDisplayFreqRange(totalBins, spanHz, hardwareSpanHz, centerFreqHz);
      ctx.save();
      ctx.font = '9px Arial, sans-serif';
      ctx.textAlign = 'center';

      const occupied: { left: number; right: number }[] = [];
      const LABEL_PAD = 4;

      for (const bc of nearbyBroadcasts) {
        const freqOffset = bc.freq_hz - displayStartFreqHz;
        const basePx = (freqOffset / displaySpanHz) * w;
        if (basePx < -20 || basePx > w + 20) continue;
        const px = basePx + dragPx;

        // Always draw the dashed frequency line
        ctx.strokeStyle = MARKER_COLOR;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();
        ctx.setLineDash([]);

        // Collision check for label placement
        const label = bc.station.length > 12 ? bc.station.substring(0, 11) + '\u2026' : bc.station;
        const textWidth = ctx.measureText(label).width;
        const pillW = textWidth + 6;
        const labelCenterX = Math.max(pillW / 2 + 1, Math.min(px, w - pillW / 2 - 1));
        const pillLeft = labelCenterX - pillW / 2;
        const pillRight = pillLeft + pillW;

        const overlaps = occupied.some(
          r => pillLeft - LABEL_PAD < r.right && pillRight + LABEL_PAD > r.left
        );
        if (overlaps) continue;

        occupied.push({ left: pillLeft, right: pillRight });

        const pillY = 1;
        const pillH = 14;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(pillLeft, pillY, pillW, pillH);
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(pillLeft, pillY, pillW, pillH);

        ctx.fillStyle = MARKER_LABEL_COLOR;
        ctx.fillText(label, labelCenterX, 11);

        newLabelRects.push({ x: pillLeft, y: pillY, w: pillW, h: pillH, freqHz: bc.freq_hz });
      }
      ctx.restore();
    }
    labelRectsRef.current = newLabelRects;

    // VFO marker (drawn LAST so it's always visible on top of everything)
    if (centerFreqHz && vfoFreqHz) {
      const { displayStartFreqHz: vfoStart, displaySpanHz: vfoSpan } = getDisplayFreqRange(totalBins, spanHz, hardwareSpanHz, centerFreqHz);
      const freqOffset = vfoFreqHz - vfoStart;
      const vfoPx = (freqOffset / vfoSpan) * w;
      const markerX = vfoPx + dragPx;
      if (markerX > -10 && markerX < w + 10) {
        ctx.strokeStyle = VFO_MARKER_COLOR;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(markerX, 0);
        ctx.lineTo(markerX, h);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    lastDrawnOffsetRef.current = dragPx;
  }, [binsRef, peakShiftRef, centerFreqHz, spanHz, hardwareSpanHz, vfoFreqHz, nearbyBroadcasts, sharedDragOffsetRef]);

  const drawOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    const dpr = dprRef.current;
    const w = overlay.width / dpr;
    const h = overlay.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const hx = hoverXRef.current;
    if (hx === null || !centerFreqHz) return;

    const dragPx = sharedDragOffsetRef.current ?? 0;

    ctx.strokeStyle = CROSSHAIR_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(hx + 0.5, 0);
    ctx.lineTo(hx + 0.5, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // Frequency label: use bin-based range for accuracy when zoomed
    const totalBins = binsRef.current?.length || 0;
    const { displayStartFreqHz, displaySpanHz } = getDisplayFreqRange(totalBins, spanHz, hardwareSpanHz, centerFreqHz);
    const norm = (hx - dragPx) / w;
    const freqHz = Math.round(displayStartFreqHz + norm * displaySpanHz);
    const label = formatFreqHz(freqHz);

    ctx.font = '11px monospace';
    ctx.textAlign = hx > w / 2 ? 'right' : 'left';
    const textX = hx > w / 2 ? hx - 6 : hx + 6;

    const tm = ctx.measureText(label);
    const pillX = hx > w / 2 ? textX - tm.width - 4 : textX - 2;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(pillX, h - 20, tm.width + 6, 16);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pillX, h - 20, tm.width + 6, 16);

    ctx.fillStyle = '#f8fafc';
    ctx.fillText(label, textX, h - 8);
  }, [centerFreqHz, spanHz, hardwareSpanHz, binsRef, sharedDragOffsetRef]);

  // Pointer handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!centerFreqHz) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    pointerDownRef.current = { x, y: e.clientY, startX: x };
    isDraggingRef.current = false;
    onDragOffsetChange(0);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [centerFreqHz, onDragOffsetChange]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    hoverXRef.current = x;
    drawOverlay();

    // Change cursor when hovering over an EiBi label
    const overlay = overlayRef.current;
    if (overlay && !pointerDownRef.current) {
      const overLabel = labelRectsRef.current.some(
        r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
      );
      overlay.style.cursor = overLabel ? 'pointer' : 'crosshair';
    }

    if (!pointerDownRef.current) return;

    const dx = Math.abs(x - pointerDownRef.current.startX);
    if (dx > DRAG_THRESHOLD) isDraggingRef.current = true;

    if (isDraggingRef.current) {
      onDragOffsetChange(x - pointerDownRef.current.startX);
    }
  }, [drawOverlay, onDragOffsetChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!pointerDownRef.current) return;

    if (!isDraggingRef.current && onTuneToFreq && centerFreqHz) {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check if click landed on an EiBi label pill
      const hitLabel = labelRectsRef.current.find(
        r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
      );
      if (hitLabel) {
        onTuneToFreq(hitLabel.freqHz);
      } else {
        const canvas = overlayRef.current;
        if (canvas) {
          const w = canvas.width / dprRef.current;
          const totalBins = binsRef.current?.length || 0;
          const { displayStartFreqHz, displaySpanHz } = getDisplayFreqRange(totalBins, spanHz, hardwareSpanHz, centerFreqHz);
          const norm = x / w;
          const freqHz = Math.round(displayStartFreqHz + norm * displaySpanHz);
          onTuneToFreq(freqHz);
        }
      }
    } else if (isDraggingRef.current && onDragEnd && centerFreqHz) {
      const canvas = overlayRef.current;
      if (canvas) {
        const w = canvas.width / dprRef.current;
        const totalBins = binsRef.current?.length || 0;
        const { displaySpanHz } = getDisplayFreqRange(totalBins, spanHz, hardwareSpanHz, centerFreqHz);
        const totalDragPx = sharedDragOffsetRef.current ?? 0;
        const deltaHz = -(totalDragPx / w) * displaySpanHz;
        onDragEnd(deltaHz);
      }
    }

    onDragOffsetChange(0);
    pointerDownRef.current = null;
    isDraggingRef.current = false;
  }, [centerFreqHz, spanHz, hardwareSpanHz, binsRef, onTuneToFreq, onDragEnd, sharedDragOffsetRef, onDragOffsetChange]);

  const handlePointerLeave = useCallback(() => {
    hoverXRef.current = null;
    drawOverlay();

    if (isDraggingRef.current && onDragEnd && centerFreqHz) {
      const canvas = overlayRef.current;
      if (canvas) {
        const w = canvas.width / dprRef.current;
        const totalBins = binsRef.current?.length || 0;
        const { displaySpanHz } = getDisplayFreqRange(totalBins, spanHz, hardwareSpanHz, centerFreqHz);
        const totalDragPx = sharedDragOffsetRef.current ?? 0;
        const deltaHz = -(totalDragPx / w) * displaySpanHz;
        onDragEnd(deltaHz);
      }
    }

    onDragOffsetChange(0);
    pointerDownRef.current = null;
    isDraggingRef.current = false;
  }, [drawOverlay, onDragEnd, centerFreqHz, spanHz, hardwareSpanHz, binsRef, sharedDragOffsetRef, onDragOffsetChange]);

  // Scroll-to-zoom handler
  useEffect(() => {
    if (!onZoomChange) return;
    const container = containerRef.current;
    if (!container) return;

    let wheelTimer: ReturnType<typeof setTimeout> | null = null;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (wheelTimer) return;
      const direction: -1 | 1 = e.deltaY < 0 ? -1 : 1;
      const spanHzNow = spanHzProp ?? DEFAULT_SPAN_HZ;
      onZoomChange(stepZoom(spanHzNow, direction));
      wheelTimer = setTimeout(() => { wheelTimer = null; }, 200);
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (wheelTimer) clearTimeout(wheelTimer);
    };
  }, [onZoomChange, spanHzProp]);

  // Animation loop: redraws on new spectrum frames OR when drag offset changes
  useEffect(() => {
    if (!visible) return;
    resizeCanvas();

    const animate = () => {
      const currentFrame = frameCountRef.current ?? 0;
      const currentOffset = sharedDragOffsetRef.current ?? 0;
      const isDragging = currentOffset !== 0;

      const newFrame = currentFrame !== lastFrameRef.current;
      const offsetChanged = currentOffset !== lastDrawnOffsetRef.current;

      if (offsetChanged || (newFrame && !isDragging)) {
        if (newFrame) lastFrameRef.current = currentFrame;
        drawSpectrum();
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [visible, resizeCanvas, drawSpectrum, frameCountRef, sharedDragOffsetRef]);

  useEffect(() => {
    if (!visible) return;
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      resizeCanvas();
      drawSpectrum();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [visible, resizeCanvas, drawSpectrum]);

  return (
    <div ref={containerRef} className="w-full relative">
      <canvas
        ref={canvasRef}
        className="block w-full rounded-t"
        style={{ touchAction: 'none', cursor: 'crosshair' }}
      />
      <canvas
        ref={overlayRef}
        className="absolute inset-0 block w-full rounded-t"
        style={{ touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      />
    </div>
  );
}
