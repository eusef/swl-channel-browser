import { useRef, useEffect, useCallback } from 'react';
import { pixelToFreqHz, freqHzToPixel, formatFreqHz, DEFAULT_SPAN_HZ } from '../lib/spectrumUtils';

interface WaterfallDisplayProps {
  binsRef: React.RefObject<Uint8Array | null>;
  frameCountRef: React.RefObject<number>;
  peakShiftRef: React.RefObject<number>;
  visible: boolean;
  centerFreqHz: number | null;
  spanHz?: number | null;
  vfoFreqHz: number | null;
  onTuneToFreq?: (freqHz: number) => void;
  onDragEnd?: (deltaHz: number) => void;
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

export default function WaterfallDisplay({
  binsRef,
  frameCountRef,
  peakShiftRef,
  visible,
  centerFreqHz,
  spanHz: spanHzProp,
  vfoFreqHz,
  onTuneToFreq,
  onDragEnd,
  sharedDragOffsetRef,
  onDragOffsetChange,
}: WaterfallDisplayProps) {
  const spanHz = spanHzProp ?? DEFAULT_SPAN_HZ;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef(-1);
  const lastDrawnOffsetRef = useRef(0);

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

    const w = overlay.width;
    const h = overlay.height;
    const dragPx = sharedDragOffsetRef.current ?? 0;
    const shift = peakShiftRef.current ?? 0;
    const binCount = binsRef.current?.length ?? 256;

    ctx.clearRect(0, 0, w, h);

    // VFO marker (tracks with drag)
    if (centerFreqHz && vfoFreqHz) {
      const vfoPx = freqHzToPixel(vfoFreqHz, w, centerFreqHz, spanHz, shift, binCount);
      if (vfoPx !== null) {
        const markerX = Math.floor(vfoPx + dragPx) + 0.5;
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

    const freqHz = pixelToFreqHz(hx - dragPx, w, centerFreqHz, spanHz, shift, binCount);
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
  }, [centerFreqHz, spanHz, vfoFreqHz, peakShiftRef, binsRef, sharedDragOffsetRef]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = getCanvasHeight();

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);
    }

    if (overlay) {
      overlay.width = width;
      overlay.height = height;
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

    const w = canvas.width;
    const h = canvas.height;
    const binCount = bins.length;

    // Scroll existing waterfall down by 1 pixel
    ctx.drawImage(canvas, 0, 0, w, h, 0, 1, w, h);

    // Draw new top line (no drag offset - raw data position)
    const imageData = ctx.createImageData(w, 1);
    const pixels = imageData.data;

    for (let x = 0; x < w; x++) {
      const displayBin = Math.floor((x / w) * binCount);
      const val = bins[Math.min(displayBin, binCount - 1)];
      const lutIdx = val * 3;

      const pixelIdx = x * 4;
      pixels[pixelIdx] = COLOR_LUT[lutIdx];
      pixels[pixelIdx + 1] = COLOR_LUT[lutIdx + 1];
      pixels[pixelIdx + 2] = COLOR_LUT[lutIdx + 2];
      pixels[pixelIdx + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
  }, [binsRef]);

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
        const w = overlay.width;
        const shift = peakShiftRef.current ?? 0;
        const binCount = binsRef.current?.length ?? 256;
        const freqHz = pixelToFreqHz(x, w, centerFreqHz, spanHz, shift, binCount);
        onTuneToFreq(freqHz);
      }
    } else if (isDraggingRef.current && onDragEnd && centerFreqHz) {
      const overlay = overlayRef.current;
      if (overlay) {
        const w = overlay.width;
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
    drawOverlayWithCursor();

    if (isDraggingRef.current && onDragEnd && centerFreqHz) {
      const overlay = overlayRef.current;
      if (overlay) {
        const w = overlay.width;
        const totalDragPx = sharedDragOffsetRef.current ?? 0;
        const deltaHz = -(totalDragPx / w) * spanHz;
        onDragEnd(deltaHz);
      }
    }

    onDragOffsetChange(0);
    pointerDownRef.current = null;
    isDraggingRef.current = false;
  }, [drawOverlayWithCursor, onDragEnd, centerFreqHz, spanHz, sharedDragOffsetRef, onDragOffsetChange]);

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
        // Normal mode: add new waterfall line
        lastFrameRef.current = currentFrame;
        drawWaterfallLine();
      }

      if (offsetChanged) {
        // Drag offset changed: redraw overlay (VFO marker tracks)
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
