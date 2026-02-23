import { describe, it, expect } from 'vitest';
import { calcBandCondition } from './propagation';

describe('calcBandCondition', () => {
  describe('higher bands (≥15 MHz / 19m and above)', () => {
    const highBandKhz = 15100; // 19m band

    it('returns good when Kp ≤ 2 and solar flux ≥ 90', () => {
      expect(calcBandCondition(0, 150, highBandKhz)).toBe('good');
      expect(calcBandCondition(1, 120, highBandKhz)).toBe('good');
      expect(calcBandCondition(2, 90, highBandKhz)).toBe('good');
    });

    it('returns fair when Kp 3-4 and solar flux ≥ 90', () => {
      expect(calcBandCondition(3, 120, highBandKhz)).toBe('fair');
      expect(calcBandCondition(4, 150, highBandKhz)).toBe('fair');
    });

    it('returns poor when Kp ≥ 5', () => {
      expect(calcBandCondition(5, 150, highBandKhz)).toBe('poor');
      expect(calcBandCondition(7, 200, highBandKhz)).toBe('poor');
      expect(calcBandCondition(9, 100, highBandKhz)).toBe('poor');
    });

    it('downgrades by one level when solar flux < 90', () => {
      // good → fair
      expect(calcBandCondition(2, 89, highBandKhz)).toBe('fair');
      expect(calcBandCondition(1, 50, highBandKhz)).toBe('fair');

      // fair → poor
      expect(calcBandCondition(3, 80, highBandKhz)).toBe('poor');
      expect(calcBandCondition(4, 70, highBandKhz)).toBe('poor');
    });

    it('poor stays poor even with low solar flux', () => {
      expect(calcBandCondition(5, 50, highBandKhz)).toBe('poor');
      expect(calcBandCondition(8, 30, highBandKhz)).toBe('poor');
    });

    it('works for other high bands (16m, 13m, 11m)', () => {
      expect(calcBandCondition(1, 150, 17480)).toBe('good');  // 16m
      expect(calcBandCondition(1, 150, 21450)).toBe('good');  // 13m
      expect(calcBandCondition(1, 150, 25600)).toBe('good');  // 11m
      expect(calcBandCondition(5, 150, 17480)).toBe('poor');  // 16m storm
    });
  });

  describe('lower bands (<15 MHz / 22m and below)', () => {
    const lowBandKhz = 9400; // 31m band

    it('returns good when Kp ≤ 4', () => {
      expect(calcBandCondition(0, 100, lowBandKhz)).toBe('good');
      expect(calcBandCondition(2, 80, lowBandKhz)).toBe('good');
      expect(calcBandCondition(4, 150, lowBandKhz)).toBe('good');
    });

    it('returns fair when Kp = 5', () => {
      expect(calcBandCondition(5, 120, lowBandKhz)).toBe('fair');
    });

    it('returns poor when Kp ≥ 6', () => {
      expect(calcBandCondition(6, 150, lowBandKhz)).toBe('poor');
      expect(calcBandCondition(9, 200, lowBandKhz)).toBe('poor');
    });

    it('is not affected by low solar flux', () => {
      // Lower bands don't get the SFI downgrade
      expect(calcBandCondition(2, 50, lowBandKhz)).toBe('good');
      expect(calcBandCondition(4, 30, lowBandKhz)).toBe('good');
    });

    it('works for various lower bands', () => {
      expect(calcBandCondition(2, 100, 2300)).toBe('good');   // 120m
      expect(calcBandCondition(2, 100, 5900)).toBe('good');   // 49m
      expect(calcBandCondition(2, 100, 7200)).toBe('good');   // 41m
      expect(calcBandCondition(2, 100, 11600)).toBe('good');  // 25m
      expect(calcBandCondition(2, 100, 13570)).toBe('good');  // 22m
    });
  });

  describe('boundary at 15 MHz threshold', () => {
    it('treats 14999 kHz as low band', () => {
      // Kp=3 → good for low band, fair for high band
      expect(calcBandCondition(3, 120, 14999)).toBe('good');
    });

    it('treats 15000 kHz as high band', () => {
      expect(calcBandCondition(3, 120, 15000)).toBe('fair');
    });
  });

  describe('edge cases', () => {
    it('handles Kp = 0', () => {
      expect(calcBandCondition(0, 100, 9400)).toBe('good');
      expect(calcBandCondition(0, 100, 15100)).toBe('good');
    });

    it('handles very high Kp values', () => {
      expect(calcBandCondition(9, 200, 9400)).toBe('poor');
      expect(calcBandCondition(9, 200, 15100)).toBe('poor');
    });

    it('handles solar flux at exactly 90 (not downgraded)', () => {
      expect(calcBandCondition(2, 90, 15100)).toBe('good');
    });

    it('handles solar flux at 89 (downgraded)', () => {
      expect(calcBandCondition(2, 89, 15100)).toBe('fair');
    });
  });
});
