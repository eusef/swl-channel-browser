import { useRef, useEffect, useCallback } from 'react';

interface WaterfallDisplayProps {
  binsRef: React.RefObject<Uint8Array | null>;
  frameCountRef: React.RefObject<number>;
  peakShiftRef: React.RefObject<number>;
  visible: boolean;
}

const CANVAS_HEIGHT_MOBILE = 100;
const CANVAS_HEIGHT_DESKTOP = 120;
const BG_COLOR = '#0f172a'; // slate-900
const CENTER_MARKER_COLOR = 'rgba(96, 165, 250, 0.5)'; // blue-400 at 50%

/**
 * Pre-computed color lookup table: maps 0-255 bin values to RGB colors.
 * Gradient: black → dark blue → cyan → yellow → red
 */
function buildColorLUT(): Uint8Array {
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let r: number, g: number, b: number;

    if (t < 0.25) {
      // black → dark blue
      const s = t / 0.25;
      r = 0;
      g = 0;
      b = Math.round(s * 140);
    } else if (t < 0.5) {
      // dark blue → cyan
      const s = (t - 0.25) / 0.25;
      r = 0;
      g = Math.round(s * 220);
      b = 140 + Math.round(s * 115);
    } else if (t < 0.75) {
      // cyan → yellow
      const s = (t - 0.5) / 0.25;
      r = Math.round(s * 255);
      g = 220 + Math.round(s * 35);
      b = 255 - Math.round(s * 255);
    } else {
      // yellow → red
      const s = (t - 0.75) / 0.25;
      r = 255;
      g = 255 - Math.round(s * 255);
      b = 0;
    }

    lut[i * 3] = r;
    lut[i * 3 + 1] = g;
    lut[i * 3 + 2] = b;
  }
  return lut;
}

const COLOR_LUT = buildColorLUT();

export default function WaterfallDisplay({ binsRef, frameCountRef, peakShiftRef, visible }: WaterfallDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef(-1);

  const getCanvasHeight = useCallback(() => {
    return window.innerWidth >= 640 ? CANVAS_HEIGHT_DESKTOP : CANVAS_HEIGHT_MOBILE;
  }, []);

  // Draw center frequency marker on overlay canvas
  const drawCenterMarker = useCallback((overlay: HTMLCanvasElement) => {
    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    const w = overlay.width;
    const h = overlay.height;

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = CENTER_MARKER_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(Math.floor(w / 2) + 0.5, 0);
    ctx.lineTo(Math.floor(w / 2) + 0.5, h);
    ctx.stroke();
    ctx.setLineDash([]);
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = getCanvasHeight();

    // For waterfall, use 1:1 pixel ratio for efficiency (no need for retina)
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Clear to background
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);
    }

    // Resize overlay and draw center marker
    if (overlay) {
      overlay.width = width;
      overlay.height = height;
      overlay.style.width = `${width}px`;
      overlay.style.height = `${height}px`;
      drawCenterMarker(overlay);
    }
  }, [getCanvasHeight, drawCenterMarker]);

  // Draw one waterfall line (with peak-centering shift)
  const drawWaterfallLine = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bins = binsRef.current;
    if (!bins || bins.length === 0) return;

    const shift = peakShiftRef.current ?? 0;
    const w = canvas.width;
    const h = canvas.height;
    const binCount = bins.length;

    // Scroll existing content down by 1 pixel using self-copy
    ctx.drawImage(canvas, 0, 0, w, h, 0, 1, w, h);

    // Draw new line at top (row 0) with shifted bins
    const imageData = ctx.createImageData(w, 1);
    const pixels = imageData.data;

    for (let x = 0; x < w; x++) {
      // Map canvas x to bin index, then apply shift
      const displayBin = Math.floor((x / w) * binCount);
      const srcBin = ((displayBin - shift) % binCount + binCount) % binCount;
      const val = bins[Math.min(srcBin, binCount - 1)];
      const lutIdx = val * 3;

      const pixelIdx = x * 4;
      pixels[pixelIdx] = COLOR_LUT[lutIdx];       // R
      pixels[pixelIdx + 1] = COLOR_LUT[lutIdx + 1]; // G
      pixels[pixelIdx + 2] = COLOR_LUT[lutIdx + 2]; // B
      pixels[pixelIdx + 3] = 255;                    // A
    }

    ctx.putImageData(imageData, 0, 0);
  }, [binsRef, peakShiftRef]);

  // Animation loop
  useEffect(() => {
    if (!visible) return;

    resizeCanvas();

    const animate = () => {
      const currentFrame = frameCountRef.current ?? 0;
      if (currentFrame !== lastFrameRef.current) {
        lastFrameRef.current = currentFrame;
        drawWaterfallLine();
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [visible, resizeCanvas, drawWaterfallLine, frameCountRef]);

  // Handle container resize
  useEffect(() => {
    if (!visible) return;

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      resizeCanvas();
    });
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
        className="absolute inset-0 block w-full rounded-b pointer-events-none"
      />
    </div>
  );
}
