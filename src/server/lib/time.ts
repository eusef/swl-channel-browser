export function getCurrentUtcHHMM(): string {
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  return `${hh}${mm}`;
}

export function getCurrentUtcDisplay(): string {
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function isInTimeWindow(start: string, end: string, now: string): boolean {
  const s = parseInt(start, 10);
  const e = parseInt(end, 10);
  const n = parseInt(now, 10);

  if (s <= e) {
    return n >= s && n < e;
  } else {
    // Midnight wraparound: e.g. 2300-0100
    return n >= s || n < e;
  }
}

export function isInSeason(seasonalStart: string, seasonalEnd: string, date: Date): boolean {
  if (!seasonalStart && !seasonalEnd) return true;

  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const todayMMDD = month * 100 + day;

  const start = seasonalStart ? parseInt(seasonalStart, 10) : 101;
  const end = seasonalEnd ? parseInt(seasonalEnd, 10) : 1231;

  if (start <= end) {
    return todayMMDD >= start && todayMMDD <= end;
  } else {
    // Year boundary: e.g. 1026-0329 (Oct 26 through Mar 29)
    return todayMMDD >= start || todayMMDD <= end;
  }
}

const DAY_ABBREVS: Record<string, number> = {
  Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6,
};

export function matchesDay(days: string, date: Date): boolean {
  if (!days || days.trim() === '') return true;

  const utcDay = date.getUTCDay();

  // Handle range like "Mo-Fr"
  const rangeMatch = days.match(/^([A-Z][a-z])-([A-Z][a-z])$/);
  if (rangeMatch) {
    const startDay = DAY_ABBREVS[rangeMatch[1]];
    const endDay = DAY_ABBREVS[rangeMatch[2]];
    if (startDay !== undefined && endDay !== undefined) {
      if (startDay <= endDay) {
        return utcDay >= startDay && utcDay <= endDay;
      } else {
        return utcDay >= startDay || utcDay <= endDay;
      }
    }
  }

  // Handle comma-separated like "Mo,We,Fr" or "Sa,Su", or single day like "Mo"
  const parts = days.split(',').map(d => d.trim());
  const allValidDays = parts.every(p => DAY_ABBREVS[p] !== undefined);
  if (allValidDays && parts.length > 0) {
    return parts.some(p => DAY_ABBREVS[p] === utcDay);
  }

  // Handle specific dates like "24Dec" - just return true as a fallback
  // (precise date matching is complex and rare in the dataset)
  if (/^\d+[A-Z][a-z]+$/.test(days)) {
    return true;
  }

  // Handle day-of-month ranges like "1-15"
  const domRange = days.match(/^(\d+)-(\d+)$/);
  if (domRange) {
    const dayOfMonth = date.getUTCDate();
    return dayOfMonth >= parseInt(domRange[1]) && dayOfMonth <= parseInt(domRange[2]);
  }

  return true; // Unknown format - include rather than exclude
}
