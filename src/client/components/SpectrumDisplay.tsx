import { useRef, useEffect, useCallback } from 'react';
import { Broadcast } from '../../shared/types';
import { pixelToFreqHz, freqHzToPixel, formatFreqHz, DEFAULT_SPAN_HZ } from '../lib/spectrumUtils';

interface SpectrumDisplayProps {
  binsRef: React.RefObject<Uint8Array | null>;
  frameCountRef: React.RefObject<number>;
  peakShiftRef: React.RefObject<number>;
  visible: boolean;
  centerFreqHz: number | null;
  spanHz?: number | null;
  vfoFreqHz: number | null;
  nearbyBroadcasts?: Broadcast[];
  onTuneToFreq?: (freqHz: number) => void;
  onDragEnd?: (deltaHz: number) => void;
  sharedDragOffsetRef: React.RefObject<number>;
  onDragOffsetChange: (px: number) => void;
}

const CANVAS_HEIGHT_MOBILE = 120;
const CANVAS_HEIGHT_DESKTOP = 150;
const GRID_COLOR = 'rgba(148, 163, 184, 0.15)';
const LINE_COLOR = '#22d3ee';
const FILL_TOP = 'rgba(34, 211, 238, 0.3)';
const FILL_BOTTOM = 'rgba(15, 23, 42, 0.8)';
const VFO_MARKER_COLOR = 'rgba(96, 165, 250, 0.7)';
const BG_COLOR = '#0f172a';
const MARKER_COLOR = 'rgba(250, 204, 21, 0.7)';
const MARKER_LABEL_COLOR = 'rgba(250, 204, 21, 0.9)';
const CROSSHAIR_COLOR = 'rgba(248, 250, 252, 0.5)';
const DRAG_THRESHOLD = 6;

export default function SpectrumDisplay({
  binsRef,
  frameCountRef,
  peakShiftRef,
  visible,
  centerFreqHz,
  spanHz: spanHzProp,
  vfoFreqHz,
  nearbyBroadcasts = [],
  onTuneToFreq,
  onDragEnd,
  sharedDragOffsetRef,
  onDragOffsetChange,
}: SpectrumDisplayProps) {
  const spanHz = spanHzProp ?? DEFAULT_SPAN_HZ;
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

    // VFO marker
    if (centerFreqHz && vfoFreqHz) {
      const vfoPx = freqHzToPixel(vfoFreqHz, w, centerFreqHz, spanHz, shift, binsRef.current?.length ?? 256);
      if (vfoPx !== null) {
        const markerX = vfoPx + dragPx;
        ctx.strokeStyle = VFO_MARKER_COLOR;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(markerX, 0);
        ctx.lineTo(markerX, h);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    const bins = binsRef.current;
    if (!bins || bins.length === 0) return;

    const binCount = bins.length;
    const xStep = w / binCount;

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, FILL_TOP);
    gradient.addColorStop(1, FILL_BOTTOM);

    // Spectrum fill
    ctx.beginPath();
    ctx.moveTo(0 + dragPx, h);
    for (let i = 0; i < binCount; i++) {
      const x = i * xStep + dragPx;
      const amplitude = bins[i] / 255;
      const y = h - amplitude * h;
      ctx.lineTo(x, y);
    }
    ctx.lineTo((binCount - 1) * xStep + dragPx, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Spectrum line
    ctx.beginPath();
    for (let i = 0; i < binCount; i++) {
      const x = i * xStep + dragPx;
      const amplitude = bins[i] / 255;
      const y = h - amplitude * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // EiBi markers
    if (centerFreqHz && nearbyBroadcasts.length > 0) {
      ctx.save();
      ctx.font = '9px Arial, sans-serif';
      ctx.textAlign = 'center';

      for (const bc of nearbyBroadcasts) {
        const basePx = freqHzToPixel(bc.freq_hz, w, centerFreqHz, spanHz, shift, binCount);
        if (basePx === null) continue;
        const px = basePx + dragPx;
        if (px < -20 || px > w + 20) continue;

        ctx.strokeStyle = MARKER_COLOR;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();
        ctx.setLineDash([]);

        const label = bc.station.length > 12 ? bc.station.substring(0, 11) + '\u2026' : bc.station;
        const textWidth = ctx.measureText(label).width;
        const labelX = Math.max(textWidth / 2 + 2, Math.min(px, w - textWidth / 2 - 2));

        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.fillRect(labelX - textWidth / 2 - 2, 1, textWidth + 4, 12);

        ctx.fillStyle = MARKER_LABEL_COLOR;
        ctx.fillText(label, labelX, 10);
      }
      ctx.restore();
    }

    lastDrawnOffsetRef.current = dragPx;
  }, [binsRef, peakShiftRef, centerFreqHz, spanHz, vfoFreqHz, nearbyBroadcasts, sharedDragOffsetRef]);

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

    const shift = peakShiftRef.current ?? 0;
    const binCount = binsRef.current?.length ?? 256;
    const dragPx = sharedDragOffsetRef.current ?? 0;

    ctx.strokeStyle = CROSSHAIR_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(hx + 0.5, 0);
    ctx.lineTo(hx + 0.5, h);
    ctx.stroke();
    ctx.setLineDash([]);

    const freqHz = pixelToFreqHz(hx - dragPx, w, centerFreqHz, spanHz, shift, binCount);
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
  }, [centerFreqHz, spanHz, peakShiftRef, binsRef, sharedDragOffsetRef]);

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
    hoverXRef.current = x;
    drawOverlay();

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
      const canvas = overlayRef.current;
      if (canvas) {
        const w = canvas.width / dprRef.current;
        const shift = peakShiftRef.current ?? 0;
        const binCount = binsRef.current?.length ?? 256;
        const freqHz = pixelToFreqHz(x, w, centerFreqHz, spanHz, shift, binCount);
        onTuneToFreq(freqHz);
      }
    } else if (isDraggingRef.current && onDragEnd && centerFreqHz) {
      const canvas = overlayRef.current;
      if (canvas) {
        const w = canvas.width / dprRef.current;
        const totalDragPx = sharedDragOffsetRef.current ?? 0;
        const deltaHz = -(totalDragPx / w) * spanHz;
        onDragEnd(deltaHz);
      }
    }

    onDragOffsetChange(0);
    pointerDownRef.current = null;
    isDraggingRef.current = false;
  }, [centerFreqHz, spanHz, onTuneToFreq, onDragEnd, peakShiftRef, binsRef, sharedDragOffsetRef, onDragOffsetChange]);

  const handlePointerLeave = useCallback(() => {
    hoverXRef.current = null;
    drawOverlay();

    if (isDraggingRef.current && onDragEnd && centerFreqHz) {
      const canvas = overlayRef.current;
      if (canvas) {
        const w = canvas.width / dprRef.current;
        const totalDragPx = sharedDragOffsetRef.current ?? 0;
        const deltaHz = -(totalDragPx / w) * spanHz;
        onDragEnd(deltaHz);
      }
    }

    onDragOffsetChange(0);
    pointerDownRef.current = null;
    isDraggingRef.current = false;
  }, [drawOverlay, onDragEnd, centerFreqHz, spanHz, sharedDragOffsetRef, onDragOffsetChange]);

  // Animation loop: redraws on new spectrum frames OR when drag offset changes
  useEffect(() => {
    if (!visible) return;
    resizeCanvas();

    const animate = () => {
      const currentFrame = frameCountRef.current ?? 0;
      const currentOffset = sharedDragOffsetRef.current ?? 0;
      const isDragging = currentOffset !== 0;

      // Redraw if: new spectrum data arrived (and not dragging), or drag offset changed
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
