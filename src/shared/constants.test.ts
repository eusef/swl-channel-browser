import { describe, it, expect } from 'vitest';
import { getBand, getLanguageName, getTargetName, BAND_RANGES } from './constants';

describe('getBand', () => {
  it('returns correct band for frequency in the middle of a range', () => {
    expect(getBand(9500)).toBe('31m');
    expect(getBand(6000)).toBe('49m');
    expect(getBand(11800)).toBe('25m');
    expect(getBand(15400)).toBe('19m');
  });

  it('returns correct band at exact lower boundary', () => {
    expect(getBand(9400)).toBe('31m');
    expect(getBand(5900)).toBe('49m');
    expect(getBand(2300)).toBe('120m');
  });

  it('returns correct band at exact upper boundary', () => {
    expect(getBand(9900)).toBe('31m');
    expect(getBand(6200)).toBe('49m');
    expect(getBand(2495)).toBe('120m');
  });

  it('returns OOB for frequencies below all bands', () => {
    expect(getBand(500)).toBe('OOB');
    expect(getBand(100)).toBe('OOB');
    expect(getBand(2299)).toBe('OOB');
  });

  it('returns OOB for frequencies above all bands', () => {
    expect(getBand(26101)).toBe('OOB');
    expect(getBand(30000)).toBe('OOB');
  });

  it('returns OOB for frequencies in gaps between bands', () => {
    // Gap between 120m (2495) and 90m (3200)
    expect(getBand(2500)).toBe('OOB');
    expect(getBand(3100)).toBe('OOB');
    // Gap between 49m (6200) and 41m (7200)
    expect(getBand(6500)).toBe('OOB');
    expect(getBand(7000)).toBe('OOB');
  });

  it('covers all defined bands', () => {
    // Verify each band in BAND_RANGES can be reached
    for (const range of BAND_RANGES) {
      const midFreq = Math.floor((range.min_khz + range.max_khz) / 2);
      expect(getBand(midFreq)).toBe(range.band);
    }
  });
});

describe('getLanguageName', () => {
  it('returns full name for common language codes', () => {
    expect(getLanguageName('E')).toBe('English');
    expect(getLanguageName('S')).toBe('Spanish');
    expect(getLanguageName('C')).toBe('Chinese');
    expect(getLanguageName('R')).toBe('Russian');
    expect(getLanguageName('A')).toBe('Arabic');
    expect(getLanguageName('F')).toBe('French');
    expect(getLanguageName('D')).toBe('German');
  });

  it('returns full name for multi-character codes', () => {
    expect(getLanguageName('H')).toBe('Hindi');
    expect(getLanguageName('Bu')).toBe('Burmese');
    expect(getLanguageName('Sw')).toBe('Swahili');
    expect(getLanguageName('Gk')).toBe('Greek');
    expect(getLanguageName('Bn')).toBe('Bengali');
    expect(getLanguageName('Ta')).toBe('Tamil');
  });

  it('returns full name for special codes', () => {
    expect(getLanguageName('-CW')).toBe('Morse Code');
    expect(getLanguageName('-MX')).toBe('Music');
    expect(getLanguageName('-TS')).toBe('Time Signal');
  });

  it('returns the code itself for unknown codes', () => {
    expect(getLanguageName('XX')).toBe('XX');
    expect(getLanguageName('ZZZ')).toBe('ZZZ');
    expect(getLanguageName('')).toBe('');
  });
});

describe('getTargetName', () => {
  it('returns full name for common target codes', () => {
    expect(getTargetName('NAm')).toBe('North America');
    expect(getTargetName('Eu')).toBe('Europe');
    expect(getTargetName('As')).toBe('Asia');
    expect(getTargetName('Af')).toBe('Africa');
    expect(getTargetName('Oc')).toBe('Oceania');
    expect(getTargetName('ME')).toBe('Middle East');
  });

  it('returns full name for regional target codes', () => {
    expect(getTargetName('EAs')).toBe('East Asia');
    expect(getTargetName('SAs')).toBe('South Asia');
    expect(getTargetName('SEAs')).toBe('South East Asia');
    expect(getTargetName('CAm')).toBe('Central America');
    expect(getTargetName('SAm')).toBe('South America');
    expect(getTargetName('WEu')).toBe('Western Europe');
    expect(getTargetName('EEu')).toBe('Eastern Europe');
  });

  it('returns the code itself for unknown targets', () => {
    expect(getTargetName('XX')).toBe('XX');
    expect(getTargetName('ZZZ')).toBe('ZZZ');
    expect(getTargetName('')).toBe('');
  });
});
