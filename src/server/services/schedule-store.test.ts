import { describe, it, expect, beforeEach } from 'vitest';
import { loadBroadcasts, getNow, getUpcoming, search, getAvailableFilters, getBroadcastCount } from './schedule-store.js';
import { parseEibiCsv } from './eibi-parser.js';

const HEADER = 'kHz;Time(UTC);Days;ITU;Station;Lng;Target;Remarks;P;Start;End\n';

function makeBroadcast(
  freq = '9500',
  time = '0000-2400',
  days = '',
  itu = 'CHN',
  station = 'China Radio Intl',
  lang = 'E',
  target = 'NAm',
  remarks = '',
  start = '',
  end = ''
) {
  return `${freq};${time};${days};${itu};${station};${lang};${target};${remarks};;${start};${end}`;
}

function loadTestData(lines: string[]) {
  const csv = HEADER + lines.join('\n');
  const broadcasts = parseEibiCsv(csv);
  loadBroadcasts(broadcasts);
  return broadcasts;
}

describe('schedule-store', () => {
  beforeEach(() => {
    loadBroadcasts([]);
  });

  describe('getNow', () => {
    it('returns broadcasts that are currently on air (24-hour broadcast)', () => {
      loadTestData([
        makeBroadcast('9500', '0000-2400'),
      ]);
      const result = getNow({});
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].freq_khz).toBe(9500);
    });

    it('filters by band', () => {
      loadTestData([
        makeBroadcast('9500', '0000-2400', '', 'CHN', 'CRI', 'E', 'NAm'),    // 31m
        makeBroadcast('6000', '0000-2400', '', 'CUB', 'RHC', 'S', 'CAm'),    // 49m
        makeBroadcast('9700', '0000-2400', '', 'USA', 'VOA', 'E', 'Af'),      // 31m
      ]);
      const result = getNow({ band: '31m' });
      expect(result.every(b => b.band === '31m')).toBe(true);
      expect(result.length).toBe(2);
    });

    it('filters by language', () => {
      loadTestData([
        makeBroadcast('9500', '0000-2400', '', 'CHN', 'CRI', 'E', 'NAm'),
        makeBroadcast('9700', '0000-2400', '', 'CHN', 'CRI', 'C', 'As'),
      ]);
      const result = getNow({ lang: 'E' });
      expect(result).toHaveLength(1);
      expect(result[0].language).toBe('E');
    });

    it('filters by target', () => {
      loadTestData([
        makeBroadcast('9500', '0000-2400', '', 'CHN', 'CRI', 'E', 'NAm'),
        makeBroadcast('9700', '0000-2400', '', 'CHN', 'CRI', 'E', 'Eu'),
      ]);
      const result = getNow({ target: 'NAm' });
      expect(result).toHaveLength(1);
      expect(result[0].target).toBe('NAm');
    });

    it('filters by free-text search', () => {
      loadTestData([
        makeBroadcast('9500', '0000-2400', '', 'CHN', 'China Radio Intl', 'E', 'NAm'),
        makeBroadcast('9700', '0000-2400', '', 'USA', 'Voice of America', 'E', 'Af'),
      ]);
      const result = getNow({ q: 'China' });
      expect(result).toHaveLength(1);
      expect(result[0].station).toBe('China Radio Intl');
    });

    it('combines multiple filters with AND logic', () => {
      loadTestData([
        makeBroadcast('9500', '0000-2400', '', 'CHN', 'CRI', 'E', 'NAm'),
        makeBroadcast('9700', '0000-2400', '', 'CHN', 'CRI', 'C', 'NAm'),
        makeBroadcast('6000', '0000-2400', '', 'CHN', 'CRI', 'E', 'Eu'),
      ]);
      const result = getNow({ band: '31m', lang: 'E' });
      expect(result).toHaveLength(1);
      expect(result[0].freq_khz).toBe(9500);
    });

    it('sorts by frequency ascending by default', () => {
      loadTestData([
        makeBroadcast('11800', '0000-2400'),
        makeBroadcast('6000', '0000-2400'),
        makeBroadcast('9500', '0000-2400'),
      ]);
      const result = getNow({});
      expect(result[0].freq_khz).toBe(6000);
      expect(result[1].freq_khz).toBe(9500);
      expect(result[2].freq_khz).toBe(11800);
    });

    it('supports descending order', () => {
      loadTestData([
        makeBroadcast('6000', '0000-2400'),
        makeBroadcast('9500', '0000-2400'),
      ]);
      const result = getNow({ sort: 'freq', order: 'desc' });
      expect(result[0].freq_khz).toBe(9500);
      expect(result[1].freq_khz).toBe(6000);
    });

    it('sorts by station name', () => {
      loadTestData([
        makeBroadcast('9500', '0000-2400', '', 'USA', 'Voice of America', 'E', 'NAm'),
        makeBroadcast('6000', '0000-2400', '', 'CHN', 'China Radio Intl', 'E', 'NAm'),
        makeBroadcast('9700', '0000-2400', '', 'CUB', 'Radio Havana Cuba', 'S', 'NAm'),
      ]);
      const result = getNow({ sort: 'station' });
      expect(result[0].station).toBe('China Radio Intl');
      expect(result[1].station).toBe('Radio Havana Cuba');
      expect(result[2].station).toBe('Voice of America');
    });

    it('sorts by language name', () => {
      loadTestData([
        makeBroadcast('9500', '0000-2400', '', 'CHN', 'CRI', 'S', 'NAm'),   // Spanish
        makeBroadcast('6000', '0000-2400', '', 'CHN', 'CRI', 'E', 'NAm'),   // English
        makeBroadcast('9700', '0000-2400', '', 'CHN', 'CRI', 'A', 'NAm'),   // Arabic
      ]);
      const result = getNow({ sort: 'lang' });
      expect(result[0].language).toBe('A');   // Arabic first
      expect(result[1].language).toBe('E');   // English second
      expect(result[2].language).toBe('S');   // Spanish third
    });

    it('filters by free-text search on language name', () => {
      loadTestData([
        makeBroadcast('9500', '0000-2400', '', 'CHN', 'CRI', 'E', 'NAm'),
        makeBroadcast('9700', '0000-2400', '', 'CHN', 'CRI', 'S', 'NAm'),
      ]);
      const result = getNow({ q: 'English' });
      expect(result).toHaveLength(1);
      expect(result[0].language).toBe('E');
    });

    it('free-text search is case insensitive', () => {
      loadTestData([
        makeBroadcast('9500', '0000-2400', '', 'CHN', 'China Radio Intl', 'E', 'NAm'),
        makeBroadcast('9700', '0000-2400', '', 'USA', 'Voice of America', 'E', 'Af'),
      ]);
      const result = getNow({ q: 'CHINA' });
      expect(result).toHaveLength(1);
      expect(result[0].station).toBe('China Radio Intl');
    });

    it('returns empty when no broadcasts match filters', () => {
      loadTestData([
        makeBroadcast('9500', '0000-2400', '', 'CHN', 'CRI', 'E', 'NAm'),
      ]);
      const result = getNow({ band: '49m' });
      expect(result).toHaveLength(0);
    });

    it('ignores short free-text queries (< 2 chars)', () => {
      loadTestData([
        makeBroadcast('9500', '0000-2400', '', 'CHN', 'CRI', 'E', 'NAm'),
        makeBroadcast('9700', '0000-2400', '', 'USA', 'VOA', 'E', 'Af'),
      ]);
      const result = getNow({ q: 'C' });
      // Single char q should not filter
      expect(result).toHaveLength(2);
    });
  });

  describe('getUpcoming', () => {
    // Helper: get a time string N hours from now in HHMM format
    function timeFromNow(hoursOffset: number): string {
      const now = new Date();
      const future = new Date(now.getTime() + hoursOffset * 60 * 60 * 1000);
      const hh = String(future.getUTCHours()).padStart(2, '0');
      const mm = String(future.getUTCMinutes()).padStart(2, '0');
      return `${hh}${mm}`;
    }

    // Helper: make a 1-hour broadcast starting at a specific HHMM time
    function makeTimedBroadcast(
      freq: string,
      startHHMM: string,
      station = 'Test Station',
      lang = 'E',
      target = 'NAm'
    ): string {
      const startH = parseInt(startHHMM.substring(0, 2), 10);
      const endH = (startH + 1) % 24;
      const endHHMM = String(endH).padStart(2, '0') + startHHMM.substring(2);
      return makeBroadcast(freq, `${startHHMM}-${endHHMM}`, '', 'USA', station, lang, target);
    }

    it('includes broadcasts starting within the window', () => {
      const in2h = timeFromNow(2);
      loadTestData([
        makeTimedBroadcast('9500', in2h, 'Upcoming Station'),
      ]);
      const result = getUpcoming(3, {});
      expect(result.some(b => b.station === 'Upcoming Station')).toBe(true);
    });

    it('excludes broadcasts starting beyond the window', () => {
      const in5h = timeFromNow(5);
      loadTestData([
        makeTimedBroadcast('9500', in5h, 'Far Future Station'),
      ]);
      const result = getUpcoming(3, {});
      expect(result.some(b => b.station === 'Far Future Station')).toBe(false);
    });

    it('excludes broadcasts currently on air', () => {
      loadTestData([
        makeBroadcast('9500', '0000-2400', '', 'CHN', 'Always On Station', 'E', 'NAm'),
      ]);
      const result = getUpcoming(6, {});
      expect(result.some(b => b.station === 'Always On Station')).toBe(false);
    });

    it('applies band filter to upcoming', () => {
      const in1h = timeFromNow(1);
      loadTestData([
        makeTimedBroadcast('9500', in1h, 'Station 31m'),   // 31m
        makeTimedBroadcast('6000', in1h, 'Station 49m'),   // 49m
      ]);
      const result = getUpcoming(3, { band: '31m' });
      expect(result.every(b => b.band === '31m')).toBe(true);
    });

    it('applies language filter to upcoming', () => {
      const in1h = timeFromNow(1);
      loadTestData([
        makeTimedBroadcast('9500', in1h, 'English Station', 'E'),
        makeTimedBroadcast('9700', in1h, 'Spanish Station', 'S'),
      ]);
      const result = getUpcoming(3, { lang: 'E' });
      expect(result.every(b => b.language === 'E')).toBe(true);
    });
  });

  describe('getBroadcastCount', () => {
    it('returns 0 when no broadcasts loaded', () => {
      expect(getBroadcastCount()).toBe(0);
    });

    it('returns correct count after loading data', () => {
      loadTestData([
        makeBroadcast('9500'),
        makeBroadcast('6000'),
        makeBroadcast('11800'),
      ]);
      expect(getBroadcastCount()).toBe(3);
    });
  });

  describe('search', () => {
    it('searches by station name', () => {
      loadTestData([
        makeBroadcast('9500', '0000-2400', '', 'CHN', 'China Radio Intl', 'E', 'NAm'),
        makeBroadcast('9700', '0000-2400', '', 'USA', 'Voice of America', 'E', 'Af'),
      ]);
      const result = search('voice');
      expect(result).toHaveLength(1);
      expect(result[0].station).toBe('Voice of America');
    });

    it('searches by frequency', () => {
      loadTestData([
        makeBroadcast('9500', '0000-2400'),
        makeBroadcast('6175', '0000-2400'),
      ]);
      const result = search('6175');
      expect(result).toHaveLength(1);
      expect(result[0].freq_khz).toBe(6175);
    });

    it('returns empty for short queries', () => {
      loadTestData([makeBroadcast()]);
      expect(search('')).toHaveLength(0);
      expect(search('a')).toHaveLength(0);
    });

    it('search is case insensitive', () => {
      loadTestData([
        makeBroadcast('9500', '0000-2400', '', 'CHN', 'China Radio Intl', 'E', 'NAm'),
      ]);
      expect(search('CHINA')).toHaveLength(1);
      expect(search('china')).toHaveLength(1);
      expect(search('China')).toHaveLength(1);
    });

    it('search matches partial station names', () => {
      loadTestData([
        makeBroadcast('9500', '0000-2400', '', 'USA', 'Voice of America', 'E', 'Af'),
      ]);
      expect(search('Voice')).toHaveLength(1);
      expect(search('America')).toHaveLength(1);
      expect(search('of')).toHaveLength(1);
    });

    it('search returns multiple matches', () => {
      loadTestData([
        makeBroadcast('9500', '0000-2400', '', 'CHN', 'Radio China', 'E', 'NAm'),
        makeBroadcast('6000', '0000-2400', '', 'CUB', 'Radio Havana', 'S', 'NAm'),
        makeBroadcast('9700', '0000-2400', '', 'USA', 'Voice of America', 'E', 'Af'),
      ]);
      const result = search('Radio');
      expect(result).toHaveLength(2);
    });
  });

  describe('getAvailableFilters', () => {
    it('returns sorted bands, languages, and targets', () => {
      loadTestData([
        makeBroadcast('9500', '0000-2400', '', 'CHN', 'CRI', 'E', 'NAm'),
        makeBroadcast('6000', '0000-2400', '', 'CUB', 'RHC', 'S', 'CAm'),
        makeBroadcast('11800', '0000-2400', '', 'IND', 'AIR', 'Hi', 'SAs'),
      ]);
      const filters = getAvailableFilters();

      // Bands should be in frequency order
      expect(filters.bands).toContain('49m');
      expect(filters.bands).toContain('31m');
      expect(filters.bands).toContain('25m');
      expect(filters.bands.indexOf('49m')).toBeLessThan(filters.bands.indexOf('31m'));
      expect(filters.bands.indexOf('31m')).toBeLessThan(filters.bands.indexOf('25m'));

      // Languages sorted by name
      expect(filters.languages.map(l => l.code)).toContain('E');
      expect(filters.languages.map(l => l.code)).toContain('S');
      expect(filters.languages.map(l => l.code)).toContain('Hi');

      // Targets present
      expect(filters.targets.map(t => t.code)).toContain('NAm');
      expect(filters.targets.map(t => t.code)).toContain('SAs');
    });

    it('excludes OOB from bands', () => {
      loadTestData([
        makeBroadcast('500', '0000-2400'),  // OOB
        makeBroadcast('9500', '0000-2400'),  // 31m
      ]);
      const filters = getAvailableFilters();
      expect(filters.bands).not.toContain('OOB');
      expect(filters.bands).toContain('31m');
    });
  });
});
