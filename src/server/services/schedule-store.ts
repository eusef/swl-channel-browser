import { Broadcast, ScheduleFilters } from '../../shared/types.js';
import { getCurrentUtcHHMM, isInTimeWindow, isInSeason, matchesDay } from '../lib/time.js';

let broadcasts: Broadcast[] = [];
let loadedAt: string | null = null;

export function loadBroadcasts(data: Broadcast[]) {
  broadcasts = data;
  loadedAt = new Date().toISOString();
  console.log(`Schedule store loaded: ${broadcasts.length} broadcasts`);
}

export function getBroadcastCount(): number {
  return broadcasts.length;
}

export function getScheduleStatus() {
  return {
    broadcast_count: broadcasts.length,
    loaded_at: loadedAt,
  };
}

function isOnNow(b: Broadcast, utcTime: string, utcDate: Date): boolean {
  if (!isInSeason(b.seasonal_start, b.seasonal_end, utcDate)) return false;
  if (b.days && !matchesDay(b.days, utcDate)) return false;
  return isInTimeWindow(b.time_start, b.time_end, utcTime);
}

function applyFilters(list: Broadcast[], filters: ScheduleFilters): Broadcast[] {
  let result = list;

  if (filters.band) {
    result = result.filter(b => b.band === filters.band);
  }
  if (filters.lang) {
    result = result.filter(b => b.language === filters.lang);
  }
  if (filters.target) {
    result = result.filter(b => b.target === filters.target);
  }
  if (filters.q && filters.q.length >= 2) {
    const q = filters.q.toLowerCase();
    result = result.filter(
      b =>
        b.station.toLowerCase().includes(q) ||
        String(b.freq_khz).includes(q) ||
        b.language_name.toLowerCase().includes(q)
    );
  }

  return sortBroadcasts(result, filters.sort || 'freq', filters.order || 'asc');
}

function sortBroadcasts(list: Broadcast[], sort: string, order: string): Broadcast[] {
  const sorted = [...list].sort((a, b) => {
    switch (sort) {
      case 'freq':
        return a.freq_khz - b.freq_khz;
      case 'station':
        return a.station.localeCompare(b.station);
      case 'lang':
        return a.language_name.localeCompare(b.language_name);
      case 'time':
        return a.time_start.localeCompare(b.time_start);
      case 'band':
        return a.freq_khz - b.freq_khz;
      default:
        return a.freq_khz - b.freq_khz;
    }
  });

  return order === 'desc' ? sorted.reverse() : sorted;
}

export function getNow(filters: ScheduleFilters): Broadcast[] {
  const utcTime = getCurrentUtcHHMM();
  const utcDate = new Date();
  const onNow = broadcasts.filter(b => isOnNow(b, utcTime, utcDate));
  return applyFilters(onNow, filters);
}

export function getUpcoming(hours: number, filters: ScheduleFilters): Broadcast[] {
  const now = new Date();
  const utcTime = getCurrentUtcHHMM();
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const endMinutes = nowMinutes + hours * 60;

  const upcoming = broadcasts.filter(b => {
    if (!isInSeason(b.seasonal_start, b.seasonal_end, now)) return false;
    if (b.days && !matchesDay(b.days, now)) return false;

    const startH = parseInt(b.time_start.substring(0, 2), 10);
    const startM = parseInt(b.time_start.substring(2, 4), 10);
    const startMinutes = startH * 60 + startM;

    // Not currently on air
    if (isInTimeWindow(b.time_start, b.time_end, utcTime)) return false;

    // Starting within the window
    if (endMinutes <= 1440) {
      return startMinutes > nowMinutes && startMinutes <= endMinutes;
    } else {
      // Wraps past midnight
      return startMinutes > nowMinutes || startMinutes <= endMinutes - 1440;
    }
  });

  const sorted = [...upcoming].sort((a, b) => {
    const aStart = parseInt(a.time_start, 10);
    const bStart = parseInt(b.time_start, 10);
    return aStart - bStart;
  });

  return applyFilters(sorted, { ...filters, sort: filters.sort || 'time' });
}

/**
 * Get broadcasts currently on-air within a frequency range.
 * Used by the interactive waterfall to overlay EiBi station markers.
 */
export function getNearby(centerKhz: number, spanKhz: number): Broadcast[] {
  const utcTime = getCurrentUtcHHMM();
  const utcDate = new Date();
  const minKhz = centerKhz - spanKhz / 2;
  const maxKhz = centerKhz + spanKhz / 2;

  return broadcasts.filter(b =>
    b.freq_khz >= minKhz &&
    b.freq_khz <= maxKhz &&
    isOnNow(b, utcTime, utcDate)
  ).sort((a, b) => a.freq_khz - b.freq_khz);
}

export function search(query: string): Broadcast[] {
  if (!query || query.length < 2) return [];

  const q = query.toLowerCase();
  return broadcasts.filter(
    b =>
      b.station.toLowerCase().includes(q) ||
      String(b.freq_khz).includes(q)
  );
}

export function getAvailableFilters() {
  const bands = new Set<string>();
  const languages = new Map<string, string>();
  const targets = new Map<string, string>();

  for (const b of broadcasts) {
    if (b.band !== 'OOB') bands.add(b.band);
    if (b.language && !languages.has(b.language)) {
      languages.set(b.language, b.language_name);
    }
    if (b.target && !targets.has(b.target)) {
      targets.set(b.target, b.target_name);
    }
  }

  // Sort bands by frequency (use BAND_RANGES order)
  const bandOrder = ['120m', '90m', '75m', '60m', '49m', '41m', '31m', '25m', '22m', '19m', '16m', '15m', '13m', '11m'];
  const sortedBands = bandOrder.filter(b => bands.has(b));

  const sortedLanguages = [...languages.entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const sortedTargets = [...targets.entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { bands: sortedBands, languages: sortedLanguages, targets: sortedTargets };
}
