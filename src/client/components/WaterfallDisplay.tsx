import { useRef, useEffect, useCallback } from 'react';
import { formatFreqHz, DEFAULT_SPAN_HZ, getDisplayFreqRange } from '../lib/spectrumUtils';
import { stepZoom } from './ZoomBar';

interface WaterfallDisplayProps {
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
  onTuneToFreq?: (freqHz: number) => void;
  onDragEnd?: (deltaHz: number) => void;
  onZoomChange?: (spanHz: number) => void;
  sharedDragOffsetRef: React.RefObject<number>;
  onDragOffsetChange: (px: number) => void;
}

const CANVAS_HEIGHT_MOBILE = 100;
const CANVAS_HEIGHT_DESKTOP = 120;
const BG_COLOR = '#0f172a';
const VFO_MARKER_COLOR = 'rgba(96, 165, 250, 0.85)';
const CROSSHAIR_COLOR = 'rgba(248, 250, 252, 0.5)';
const DRAG_THRESHOLD = 6;

function buildColorLUT(): Uint8Array {
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let r: number, g: number, b: number;

    if (t < 0.25) {
      const s = t / 0.25;
      r = 0; g = 0; b = Math.round(s * 140);
    } else if (t < 0.5) {
      const s = (t - 0.25) / 0.25;
      r = 0; g = Math.round(s * 220); b = 140 + Math.round(s * 115);
    } else if (t < 0.75) {
      const s = (t - 0.5) / 0.25;
      r = Math.round(s * 255); g = 220 + Math.round(s * 35); b = 255 - Math.round(s * 255);
    } else {
      const s = (t - 0.75) / 0.25;
      r = 255; g = 255 - Math.round(s * 255); b = 0;
    }

    lut[i * 3] = r;
    lut[i * 3 + 1] = g;
    lut[i * 3 + 2] = b;
  }
  return lut;
}

const COLOR_LUT = buildColorLUT();

/** Compute visible bin range for software zoom */
function getVisibleBins(totalBins: number, spanHz: number, hardwareSpanHz: number) {
  if (spanHz >= hardwareSpanHz) return { startBin: 0, visibleCount: totalBins };
  const ratio = spanHz / hardwareSpanHz;
  const visibleCount = Math.max(2, Math.round(totalBins * ratio));
  const startBin = Math.floor((totalBins - visibleCount) / 2);
  return { startBin, visibleCount };
}

export default function WaterfallDisplay({
  binsRef,
  frameCountRef,
  peakShiftRef,
  visible,
  centerFreqHz,
  spanHz: spanHzProp,
  hardwareSpanHz: hardwareSpanHzProp,
  vfoFreqHz,
  onTuneToFreq,
  onDragEnd,
  onZoomChange,
  sharedDragOffsetRef,
  onDragOffsetChange,
}: WaterfallDisplayProps) {
  const spanHz = spanHzProp ?? DEFAULT_SPAN_HZ;
  const hardwareSpanHz = hardwareSpanHzProp ?? spanHz;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef(-1);
  const lastDrawnOffsetRef = useRef(0);
  const dprRef = useRef(window.devicePixelRatio || 1);

  const pointerDownRef = useRef<{ x: number; startX: number } | null>(null);
  const isDraggingRef = useRef(false);
  const hoverXRef = useRef<number | null>(null);

  const getCanvasHeight = useCallback(() => {
    return window.innerWidth >= 640 ? CANVAS_HEIGHT_DESKTOP : CANVAS_HEIGHT_MOBILE;
  }, []);

  const drawOverlayWithCursor = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    const dpr = dprRef.current;
    const w = overlay.width / dpr;
    const h = overlay.height / dpr;
    const dragPx = sharedDragOffsetRef.current ?? 0;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // VFO marker (tracks with drag) - use bin-based range for alignment
    if (centerFreqHz && vfoFreqHz) {
      const totalBins = binsRef.current?.length || 0;
      const { displayStartFreqHz, displaySpanHz } = getDisplayFreqRange(totalBins, spanHz, hardwareSpanHz, centerFreqHz);
      const freqOffset = vfoFreqHz - displayStartFreqHz;
      const vfoPx = (freqOffset / displaySpanHz) * w;
      const markerX = Math.floor(vfoPx + dragPx) + 0.5;
      if (markerX > -10 && markerX < w + 10) {
        ctx.strokeStyle = VFO_MARKER_COLOR;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(markerX, 0);
        ctx.lineTo(markerX, h);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Crosshair + frequency readout
    const hx = hoverXRef.current;
    if (hx === null || !centerFreqHz) return;

    ctx.strokeStyle = CROSSHAIR_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(hx + 0.5, 0);
    ctx.lineTo(hx + 0.5, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // Frequency label: use bin-based range for accuracy when zoomed
    const totalBinsLabel = binsRef.current?.length || 0;
    const { displayStartFreqHz: labelStart, displaySpanHz: labelSpan } = getDisplayFreqRange(totalBinsLabel, spanHz, hardwareSpanHz, centerFreqHz);
    const norm = (hx - dragPx) / w;
    const freqHz = Math.round(labelStart + norm * labelSpan);
    const label = formatFreqHz(freqHz);

    ctx.font = '11px monospace';
    ctx.textAlign = hx > w / 2 ? 'right' : 'left';
    const textX = hx > w / 2 ? hx - 6 : hx + 6;

    const tm = ctx.measureText(label);
    const pillX = hx > w / 2 ? textX - tm.width - 4 : textX - 2;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(pillX, 2, tm.width + 6, 16);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pillX, 2, tm.width + 6, 16);

    ctx.fillStyle = '#f8fafc';
    ctx.fillText(label, textX, 14);

    lastDrawnOffsetRef.current = dragPx;
  }, [centerFreqHz, spanHz, hardwareSpanHz, binsRef, vfoFreqHz, sharedDragOffsetRef]);

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

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);
    }

    if (overlay) {
      overlay.width = width * dpr;
      overlay.height = height * dpr;
      overlay.style.width = `${width}px`;
      overlay.style.height = `${height}px`;
      drawOverlayWithCursor();
    }
  }, [getCanvasHeight, drawOverlayWithCursor]);

  const drawWaterfallLine = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bins = binsRef.current;
    if (!bins || bins.length === 0) return;

    const dpr = dprRef.current;
    const pw = canvas.width;   // physical width
    const ph = canvas.height;  // physical height
    const totalBins = bins.length;
    const { startBin, visibleCount } = getVisibleBins(totalBins, spanHz, hardwareSpanHz);

    // Reset transform for raw pixel operations
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Scroll existing waterfall down by dpr pixels (1 logical row)
    const scrollPx = Math.round(dpr);
    ctx.drawImage(canvas, 0, 0, pw, ph, 0, scrollPx, pw, ph);

    // Draw new top rows (only visible bins, stretched to full width)
    const imageData = ctx.createImageData(pw, scrollPx);
    const pixels = imageData.data;

    for (let row = 0; row < scrollPx; row++) {
      for (let x = 0; x < pw; x++) {
        // Map pixel position to a bin within the visible range
        const displayBin = Math.floor((x / pw) * visibleCount);
        const actualBin = startBin + Math.min(displayBin, visibleCount - 1);
        const val = bins[actualBin];
        const lutIdx = val * 3;

        const pixelIdx = (row * pw + x) * 4;
        pixels[pixelIdx] = COLOR_LUT[lutIdx];
        pixels[pixelIdx + 1] = COLOR_LUT[lutIdx + 1];
        pixels[pixelIdx + 2] = COLOR_LUT[lutIdx + 2];
        pixels[pixelIdx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, [binsRef, spanHz, hardwareSpanHz]);

  // Pointer handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!centerFreqHz) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    pointerDownRef.current = { x, startX: x };
    isDraggingRef.current = false;
    onDragOffsetChange(0);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [centerFreqHz, onDragOffsetChange]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    hoverXRef.current = x;
    drawOverlayWithCursor();

    if (!pointerDownRef.current) return;

    const dx = Math.abs(x - pointerDownRef.current.startX);
    if (dx > DRAG_THRESHOLD) isDraggingRef.current = true;

    if (isDraggingRef.current) {
      onDragOffsetChange(x - pointerDownRef.current.startX);
    }
  }, [drawOverlayWithCursor, onDragOffsetChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!pointerDownRef.current) return;

    if (!isDraggingRef.current && onTuneToFreq && centerFreqHz) {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const overlay = overlayRef.current;
      if (overlay) {
        const w = overlay.width / dprRef.current;
        const totalBins = binsRef.current?.length || 0;
        const { displayStartFreqHz, displaySpanHz } = getDisplayFreqRange(totalBins, spanHz, hardwareSpanHz, centerFreqHz);
        const norm = x / w;
        const freqHz = Math.round(displayStartFreqHz + norm * displaySpanHz);
        onTuneToFreq(freqHz);
      }
    } else if (isDraggingRef.current && onDragEnd && centerFreqHz) {
      const overlay = overlayRef.current;
      if (overlay) {
        const w = overlay.width / dprRef.current;
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
    drawOverlayWithCursor();

    if (isDraggingRef.current && onDragEnd && centerFreqHz) {
      const overlay = overlayRef.current;
      if (overlay) {
        const w = overlay.width / dprRef.current;
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
  }, [drawOverlayWithCursor, onDragEnd, centerFreqHz, spanHz, hardwareSpanHz, binsRef, sharedDragOffsetRef, onDragOffsetChange]);

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

  // Animation loop: adds waterfall lines when not dragging, updates overlay when dragging
  useEffect(() => {
    if (!visible) return;
    resizeCanvas();

    const animate = () => {
      const currentFrame = frameCountRef.current ?? 0;
      const currentOffset = sharedDragOffsetRef.current ?? 0;
      const isDragging = currentOffset !== 0;
      const newFrame = currentFrame !== lastFrameRef.current;
      const offsetChanged = currentOffset !== lastDrawnOffsetRef.current;

      if (newFrame && !isDragging) {
        lastFrameRef.current = currentFrame;
        drawWaterfallLine();
      }

      if (offsetChanged) {
        drawOverlayWithCursor();
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [visible, resizeCanvas, drawWaterfallLine, drawOverlayWithCursor, frameCountRef, sharedDragOffsetRef]);

  useEffect(() => {
    if (!visible) return;
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(container);
    return () => observer.disconnect();
  }, [visible, resizeCanvas]);

  return (
    <div ref={containerRef} className="w-full relative" style={{ touchAction: 'none' }}>
      <canvas
        ref={canvasRef}
        className="block w-full rounded-b"
        style={{ touchAction: 'none' }}
      />
      <canvas
        ref={overlayRef}
        className="absolute inset-0 block w-full rounded-b"
        style={{ touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      />
    </div>
  );
}
