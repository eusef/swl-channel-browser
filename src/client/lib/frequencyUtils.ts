import { Broadcast, DemodMode } from '../../shared/types';
import { getBand, BAND_RANGES } from '../../shared/constants';

/** Standard bandwidth (Hz) for each demod mode */
export function bandwidthForMode(mode: DemodMode): number {
  switch (mode) {
    case 'AM':
    case 'SAM': return 7500;
    case 'USB':
    case 'LSB': return 3000;
    case 'CW':  return 500;
    case 'NFM': return 12500;
    case 'WFM': return 150000;
    default:    return 7500;
  }
}

/**
 * Parse a frequency string into kHz and Hz values.
 * Accepts: "7200", "7200.5", "7.200" (MHz if < 100)
 * Returns null if invalid.
 */
export function normalizeFrequency(input: string): { freq_khz: number; freq_hz: number } | null {
  const trimmed = input.trim().replace(/[^\d.]/g, '');
  if (!trimmed) return null;

  const num = parseFloat(trimmed);
  if (isNaN(num) || num <= 0) return null;

  // If the value is small (< 100), assume MHz input
  let freq_khz: number;
  if (num < 100) {
    freq_khz = Math.round(num * 1000 * 10) / 10; // e.g. 7.2 MHz -> 7200 kHz
  } else {
    freq_khz = Math.round(num * 10) / 10; // e.g. 7200 -> 7200 kHz
  }

  return {
    freq_khz,
    freq_hz: Math.round(freq_khz * 1000),
  };
}

/** Simple client-side demod mode derivation from frequency.
 *  Defaults to SAM (Synchronous AM) which is the standard mode
 *  used by SDRconnect for AM reception. Plain 'AM' is not
 *  recognized by SDRconnect and will crash the connection. */
export function deriveDemodFromFreq(freq_khz: number): DemodMode {
  return 'SAM';
}

/** Check if a frequency falls within a known broadcast band */
export function validateFrequency(freq_khz: number): { valid: boolean; band: string; warning?: string } {
  const band = getBand(freq_khz);
  const minFreq = BAND_RANGES[0].min_khz;
  const maxFreq = BAND_RANGES[BAND_RANGES.length - 1].max_khz;

  if (freq_khz < 1 || freq_khz > 1000000) {
    return { valid: false, band: 'OOB', warning: 'Frequency out of range' };
  }

  if (band === 'OOB') {
    if (freq_khz < minFreq || freq_khz > maxFreq) {
      return { valid: true, band: 'OOB', warning: 'Outside standard broadcast bands' };
    }
    return { valid: true, band: 'OOB', warning: 'Between broadcast bands' };
  }

  return { valid: true, band };
}

/**
 * Create a synthetic Broadcast object from manual entry data.
 * Uses dummy values for schedule fields that don't apply to ad-hoc tuning.
 */
export function createSyntheticBroadcast(
  freq_khz: number,
  station: string,
  demod_mode: DemodMode,
  bandwidth: number,
): Broadcast {
  const band = getBand(freq_khz);
  return {
    freq_khz,
    freq_hz: Math.round(freq_khz * 1000),
    time_start: '00:00',
    time_end: '23:59',
    days: 'daily',
    country_code: '',
    station: station || `Manual @ ${freq_khz} kHz`,
    language: '',
    language_name: '',
    target: '',
    target_name: '',
    remarks: 'manual-entry',
    band,
    demod_mode,
    bandwidth,
    seasonal_start: '',
    seasonal_end: '',
  };
}
