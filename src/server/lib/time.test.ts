import { describe, it, expect } from 'vitest';
import { isInTimeWindow, isInSeason, matchesDay } from './time.js';

describe('isInTimeWindow', () => {
  it('returns true when time is within a normal window', () => {
    expect(isInTimeWindow('0900', '1700', '1200')).toBe(true);
  });

  it('returns false when time is before the window', () => {
    expect(isInTimeWindow('0900', '1700', '0800')).toBe(false);
  });

  it('returns false when time is after the window', () => {
    expect(isInTimeWindow('0900', '1700', '1800')).toBe(false);
  });

  it('returns true at exact start time', () => {
    expect(isInTimeWindow('0900', '1700', '0900')).toBe(true);
  });

  it('returns false at exact end time (exclusive)', () => {
    expect(isInTimeWindow('0900', '1700', '1700')).toBe(false);
  });

  it('handles midnight wraparound — time after start', () => {
    expect(isInTimeWindow('2300', '0100', '2330')).toBe(true);
  });

  it('handles midnight wraparound — time after midnight', () => {
    expect(isInTimeWindow('2300', '0100', '0030')).toBe(true);
  });

  it('handles midnight wraparound — time outside window', () => {
    expect(isInTimeWindow('2300', '0100', '1200')).toBe(false);
  });

  it('handles midnight wraparound — time just before start', () => {
    expect(isInTimeWindow('2300', '0100', '2259')).toBe(false);
  });
});

describe('isInSeason', () => {
  it('returns true when no seasonal constraints', () => {
    expect(isInSeason('', '', new Date('2026-06-15T00:00:00Z'))).toBe(true);
  });

  it('returns true when date is within season', () => {
    // Season: March 1 - September 30
    expect(isInSeason('0301', '0930', new Date('2026-06-15T00:00:00Z'))).toBe(true);
  });

  it('returns false when date is outside season', () => {
    expect(isInSeason('0301', '0930', new Date('2026-12-15T00:00:00Z'))).toBe(false);
  });

  it('handles year boundary — date in first segment', () => {
    // Season: October 26 - March 29 (crosses year boundary)
    expect(isInSeason('1026', '0329', new Date('2026-11-15T00:00:00Z'))).toBe(true);
  });

  it('handles year boundary — date in second segment', () => {
    expect(isInSeason('1026', '0329', new Date('2026-02-15T00:00:00Z'))).toBe(true);
  });

  it('handles year boundary — date outside', () => {
    expect(isInSeason('1026', '0329', new Date('2026-06-15T00:00:00Z'))).toBe(false);
  });

  it('returns true when only start is set and date is after', () => {
    expect(isInSeason('0601', '', new Date('2026-08-15T00:00:00Z'))).toBe(true);
  });

  it('returns true when only end is set and date is before', () => {
    expect(isInSeason('', '0930', new Date('2026-06-15T00:00:00Z'))).toBe(true);
  });
});

describe('matchesDay', () => {
  // 2026-02-22 is a Sunday (UTC day 0)
  const sunday = new Date('2026-02-22T12:00:00Z');
  // 2026-02-23 is a Monday (UTC day 1)
  const monday = new Date('2026-02-23T12:00:00Z');
  // 2026-02-25 is a Wednesday (UTC day 3)
  const wednesday = new Date('2026-02-25T12:00:00Z');
  // 2026-02-27 is a Friday (UTC day 5)
  const friday = new Date('2026-02-27T12:00:00Z');
  // 2026-02-28 is a Saturday (UTC day 6)
  const saturday = new Date('2026-02-28T12:00:00Z');

  it('returns true when days is empty', () => {
    expect(matchesDay('', monday)).toBe(true);
  });

  it('returns true for matching day range (Mo-Fr on Wednesday)', () => {
    expect(matchesDay('Mo-Fr', wednesday)).toBe(true);
  });

  it('returns false for non-matching day range (Mo-Fr on Sunday)', () => {
    expect(matchesDay('Mo-Fr', sunday)).toBe(false);
  });

  it('returns true for matching day range (Mo-Fr on Monday)', () => {
    expect(matchesDay('Mo-Fr', monday)).toBe(true);
  });

  it('returns true for matching day range (Mo-Fr on Friday)', () => {
    expect(matchesDay('Mo-Fr', friday)).toBe(true);
  });

  it('handles comma-separated days', () => {
    expect(matchesDay('Sa,Su', sunday)).toBe(true);
    expect(matchesDay('Sa,Su', saturday)).toBe(true);
    expect(matchesDay('Sa,Su', monday)).toBe(false);
  });

  it('handles single day', () => {
    expect(matchesDay('Mo', monday)).toBe(true);
    expect(matchesDay('Mo', wednesday)).toBe(false);
  });

  it('returns true for specific date format (fallback)', () => {
    expect(matchesDay('24Dec', monday)).toBe(true);
  });

  it('handles day-of-month range', () => {
    // monday is Feb 23
    expect(matchesDay('20-28', monday)).toBe(true);
    // Feb 23 is not in 1-15
    expect(matchesDay('1-15', monday)).toBe(false);
  });
});
