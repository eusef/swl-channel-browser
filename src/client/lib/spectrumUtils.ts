/**
 * Utilities for mapping between canvas pixel positions and radio frequencies
 * in the spectrum/waterfall displays.
 *
 * The SDRconnect spectrum covers a span equal to the sample rate (default 1 MHz)
 * centered on the current VFO frequency. The display may apply a "peak shift"
 * to visually center the strongest signal.
 */

/** Default display span in Hz (1 MSPS sample rate = 1 MHz) */
export const DEFAULT_SPAN_HZ = 1_000_000;

/**
 * Convert a canvas X pixel position to a frequency in Hz.
 *
 * @param x - Pixel position on canvas (0 = left edge)
 * @param canvasWidth - Total canvas width in pixels
 * @param centerFreqHz - Current VFO/center frequency in Hz
 * @param spanHz - Display span in Hz (default 1 MHz)
 * @param peakShift - Bin shift applied by peak centering (default 0)
 * @param binCount - Number of spectrum bins (default 256)
 */
export function pixelToFreqHz(
  x: number,
  canvasWidth: number,
  centerFreqHz: number,
  spanHz: number = DEFAULT_SPAN_HZ,
  peakShift: number = 0,
  binCount: number = 256,
): number {
  // Canvas X to normalized position [0, 1]
  const norm = x / canvasWidth;

  // The display bin at this position
  const displayBin = norm * binCount;

  // Reverse the peak shift to get the actual bin
  const actualBin = ((displayBin - peakShift) % binCount + binCount) % binCount;

  // Bin to frequency offset from the start of the span
  const freqOffset = (actualBin / binCount) * spanHz;

  // Frequency = (center - span/2) + offset
  // Note: SDRconnect places VFO at ~10% from left, but the spectrum bins
  // represent the full span starting from center - span/2
  return Math.round(centerFreqHz - spanHz / 2 + freqOffset);
}

/**
 * Convert a frequency in Hz to a canvas X pixel position.
 *
 * @param freqHz - Frequency in Hz
 * @param canvasWidth - Total canvas width in pixels
 * @param centerFreqHz - Current VFO/center frequency in Hz
 * @param spanHz - Display span in Hz (default 1 MHz)
 * @param peakShift - Bin shift applied by peak centering (default 0)
 * @param binCount - Number of spectrum bins (default 256)
 * @returns X pixel position, or null if frequency is outside visible range
 */
export function freqHzToPixel(
  freqHz: number,
  canvasWidth: number,
  centerFreqHz: number,
  spanHz: number = DEFAULT_SPAN_HZ,
  peakShift: number = 0,
  binCount: number = 256,
): number | null {
  const startFreq = centerFreqHz - spanHz / 2;
  const endFreq = centerFreqHz + spanHz / 2;

  if (freqHz < startFreq || freqHz > endFreq) return null;

  // Frequency offset to bin index
  const freqOffset = freqHz - startFreq;
  const actualBin = (freqOffset / spanHz) * binCount;

  // Apply peak shift to get display bin
  const displayBin = ((actualBin + peakShift) % binCount + binCount) % binCount;

  // Display bin to pixel
  return (displayBin / binCount) * canvasWidth;
}

/**
 * Format a frequency in Hz to a human-readable string.
 * Uses kHz for < 30 MHz, MHz for >= 30 MHz.
 */
export function formatFreqHz(freqHz: number): string {
  if (freqHz >= 30_000_000) {
    return `${(freqHz / 1_000_000).toFixed(3)} MHz`;
  }
  return `${(freqHz / 1_000).toFixed(1)} kHz`;
}
