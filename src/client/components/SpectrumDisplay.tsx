import { useRef, useEffect, useCallback } from 'react';

interface SpectrumDisplayProps {
  binsRef: React.RefObject<Uint8Array | null>;
  frameCountRef: React.RefObject<number>;
  peakShiftRef: React.RefObject<number>;
  visible: boolean;
}

const CANVAS_HEIGHT_MOBILE = 120;
const CANVAS_HEIGHT_DESKTOP = 150;
const GRID_COLOR = 'rgba(148, 163, 184, 0.15)'; // slate-400 at 15%
const LINE_COLOR = '#22d3ee';   // cyan-400
const FILL_TOP = 'rgba(34, 211, 238, 0.3)';  // cyan-400 at 30%
const FILL_BOTTOM = 'rgba(15, 23, 42, 0.8)'; // slate-900 at 80%
const CENTER_MARKER_COLOR = 'rgba(96, 165, 250, 0.6)'; // blue-400 at 60%
const BG_COLOR = '#0f172a'; // slate-900

/** Read a bin value with wrapping shift applied */
function shiftedBin(bins: Uint8Array, index: number, shift: number): number {
  const srcIdx = ((index - shift) % bins.length + bins.length) % bins.length;
  return bins[srcIdx];
}

export default function SpectrumDisplay({ binsRef, frameCountRef, peakShiftRef, visible }: SpectrumDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef(-1);
  const dprRef = useRef(window.devicePixelRatio || 1);

  const getCanvasHeight = useCallback(() => {
    return window.innerWidth >= 640 ? CANVAS_HEIGHT_DESKTOP : CANVAS_HEIGHT_MOBILE;
  }, []);

  // Resize canvas to match container
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
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
  }, [getCanvasHeight]);

  // Draw spectrum frame
  const drawSpectrum = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = dprRef.current;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // Draw horizontal grid lines
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = (h * i) / 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Draw center frequency marker
    ctx.strokeStyle = CENTER_MARKER_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.setLineDash([]);

    const bins = binsRef.current;
    if (!bins || bins.length === 0) return;

    const shift = peakShiftRef.current ?? 0;
    const binCount = bins.length;
    const xStep = w / binCount;

    // Create gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, FILL_TOP);
    gradient.addColorStop(1, FILL_BOTTOM);

    // Draw filled area (with peak-centering shift)
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < binCount; i++) {
      const x = i * xStep;
      const amplitude = shiftedBin(bins, i, shift) / 255;
      const y = h - amplitude * h;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line on top
    ctx.beginPath();
    for (let i = 0; i < binCount; i++) {
      const x = i * xStep;
      const amplitude = shiftedBin(bins, i, shift) / 255;
      const y = h - amplitude * h;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [binsRef, peakShiftRef]);

  // Animation loop
  useEffect(() => {
    if (!visible) return;

    resizeCanvas();

    const animate = () => {
      const currentFrame = frameCountRef.current ?? 0;
      if (currentFrame !== lastFrameRef.current) {
        lastFrameRef.current = currentFrame;
        drawSpectrum();
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [visible, resizeCanvas, drawSpectrum, frameCountRef]);

  // Handle container resize
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
    <div ref={containerRef} className="w-full">
      <canvas
        ref={canvasRef}
        className="block w-full rounded-t"
        style={{ touchAction: 'none' }}
      />
    </div>
  );
}
