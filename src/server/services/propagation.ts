import { BandCondition, PropagationData } from '../../shared/types.js';
import { BAND_RANGES } from '../../shared/constants.js';

const KP_URL = 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json';
const FLUX_URL = 'https://services.swpc.noaa.gov/json/f107_cm_flux.json';

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let cache: { data: PropagationData; fetchedAt: number } | null = null;

/**
 * Threshold in kHz above which a band is considered "higher" (more sensitive to Kp).
 * Bands ≥ 15 MHz (19m and above) need good ionisation and are hit harder by storms.
 */
const HIGH_BAND_THRESHOLD_KHZ = 15000;

/**
 * Calculate band condition based on Kp index, solar flux, and band frequency.
 *
 * Simplified propagation model:
 * - Higher bands (≥15 MHz): need low Kp AND decent solar flux to be "good"
 * - Lower bands (<15 MHz): more resilient to geomagnetic disturbance
 * - Solar flux < 90 downgrades higher bands (not enough ionisation)
 */
export function calcBandCondition(
  kp: number,
  solarFlux: number,
  bandMinKhz: number,
): BandCondition {
  const isHighBand = bandMinKhz >= HIGH_BAND_THRESHOLD_KHZ;

  let condition: BandCondition;

  if (isHighBand) {
    // Higher bands: sensitive to both Kp and solar flux
    if (kp <= 2) condition = 'good';
    else if (kp <= 4) condition = 'fair';
    else condition = 'poor';

    // Low solar flux downgrades higher bands by one level
    if (solarFlux < 90) {
      if (condition === 'good') condition = 'fair';
      else if (condition === 'fair') condition = 'poor';
    }
  } else {
    // Lower bands: more resilient
    if (kp <= 4) condition = 'good';
    else if (kp <= 5) condition = 'fair';
    else condition = 'poor';
  }

  return condition;
}

/**
 * Build band_conditions map for all known shortwave bands.
 */
function buildBandConditions(kp: number, solarFlux: number): Record<string, BandCondition> {
  const conditions: Record<string, BandCondition> = {};
  for (const range of BAND_RANGES) {
    conditions[range.band] = calcBandCondition(kp, solarFlux, range.min_khz);
  }
  return conditions;
}

/**
 * Fetch the latest Kp index from NOAA SWPC.
 * Returns the most recent entry from the 1-minute planetary K-index array.
 */
async function fetchKpIndex(): Promise<number> {
  const res = await fetch(KP_URL);
  if (!res.ok) throw new Error(`NOAA Kp fetch failed: ${res.status}`);

  const data: { time_tag: string; estimated_kp: number }[] = await res.json();
  if (!data.length) throw new Error('NOAA Kp data empty');

  // Last entry is most recent
  const latest = data[data.length - 1];
  return latest.estimated_kp ?? 0;
}

/**
 * Fetch the latest solar flux (F10.7) from NOAA SWPC.
 * Returns the most recent observed flux value.
 */
async function fetchSolarFlux(): Promise<number> {
  const res = await fetch(FLUX_URL);
  if (!res.ok) throw new Error(`NOAA flux fetch failed: ${res.status}`);

  const data: { time_tag: string; flux: number }[] = await res.json();
  if (!data.length) throw new Error('NOAA flux data empty');

  const latest = data[data.length - 1];
  return latest.flux ?? 100;
}

/**
 * Get current propagation data. Returns cached data if fresh enough,
 * otherwise fetches from NOAA. Gracefully returns stale data on fetch failure.
 */
export async function fetchPropagation(): Promise<PropagationData> {
  const now = Date.now();

  // Return cached data if still fresh
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  try {
    const [kp, flux] = await Promise.all([fetchKpIndex(), fetchSolarFlux()]);

    const data: PropagationData = {
      kp_index: Math.round(kp * 10) / 10,
      solar_flux: Math.round(flux),
      updated_at: new Date().toISOString(),
      band_conditions: buildBandConditions(kp, flux),
    };

    cache = { data, fetchedAt: now };
    return data;
  } catch (err) {
    console.error('[Propagation] NOAA fetch error:', err);

    // Return stale cache if available
    if (cache) {
      return cache.data;
    }

    // Fallback: return unknown conditions
    const conditions: Record<string, BandCondition> = {};
    for (const range of BAND_RANGES) {
      conditions[range.band] = 'unknown';
    }

    return {
      kp_index: 0,
      solar_flux: 0,
      updated_at: new Date().toISOString(),
      band_conditions: conditions,
    };
  }
}
