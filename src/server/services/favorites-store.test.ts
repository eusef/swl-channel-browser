import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadFavorites,
  addFavorite,
  removeFavorite,
  findFavorite,
} from './favorites-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FAVORITES_PATH = path.resolve(__dirname, '../../../data/favorites.json');

describe('favorites-store', () => {
  // Back up and restore the favorites file around tests
  let backup: string | null = null;

  beforeEach(() => {
    try {
      backup = fs.readFileSync(FAVORITES_PATH, 'utf-8');
    } catch {
      backup = null;
    }
    // Start with empty favorites
    const dir = path.dirname(FAVORITES_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FAVORITES_PATH, '[]', 'utf-8');
  });

  afterEach(() => {
    if (backup !== null) {
      fs.writeFileSync(FAVORITES_PATH, backup, 'utf-8');
    } else {
      try { fs.unlinkSync(FAVORITES_PATH); } catch { /* ignore */ }
    }
  });

  it('loadFavorites returns empty array when no file', () => {
    try { fs.unlinkSync(FAVORITES_PATH); } catch { /* ignore */ }
    expect(loadFavorites()).toEqual([]);
  });

  it('addFavorite creates a favorite with id and timestamp', () => {
    const fav = addFavorite({
      freq_khz: 9500,
      freq_hz: 9500000,
      station: 'China Radio Intl',
      language: 'E',
      target: 'NAm',
      demod_mode: 'AM',
      bandwidth: 7500,
      notes: 'Good signal',
    });

    expect(fav.id).toBeDefined();
    expect(fav.id.length).toBeGreaterThan(0);
    expect(fav.freq_khz).toBe(9500);
    expect(fav.station).toBe('China Radio Intl');
    expect(fav.notes).toBe('Good signal');
    expect(fav.added_at).toBeDefined();
  });

  it('addFavorite persists to file', () => {
    addFavorite({
      freq_khz: 6000,
      freq_hz: 6000000,
      station: 'RHC',
      language: 'S',
      target: 'CAm',
      demod_mode: 'AM',
      bandwidth: 7500,
      notes: '',
    });

    const loaded = loadFavorites();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].station).toBe('RHC');
  });

  it('removeFavorite deletes by id', () => {
    const fav = addFavorite({
      freq_khz: 9500,
      freq_hz: 9500000,
      station: 'CRI',
      language: 'E',
      target: 'NAm',
      demod_mode: 'AM',
      bandwidth: 7500,
      notes: '',
    });

    expect(removeFavorite(fav.id)).toBe(true);
    expect(loadFavorites()).toHaveLength(0);
  });

  it('removeFavorite returns false for nonexistent id', () => {
    expect(removeFavorite('nonexistent-id')).toBe(false);
  });

  it('findFavorite returns matching favorite', () => {
    addFavorite({
      freq_khz: 9500,
      freq_hz: 9500000,
      station: 'CRI',
      language: 'E',
      target: 'NAm',
      demod_mode: 'AM',
      bandwidth: 7500,
      notes: '',
    });

    const found = findFavorite(9500, 'CRI');
    expect(found).toBeDefined();
    expect(found!.freq_khz).toBe(9500);
  });

  it('findFavorite returns undefined when not found', () => {
    expect(findFavorite(9999, 'Unknown')).toBeUndefined();
  });

  it('handles multiple favorites', () => {
    addFavorite({ freq_khz: 9500, freq_hz: 9500000, station: 'CRI', language: 'E', target: 'NAm', demod_mode: 'AM', bandwidth: 7500, notes: '' });
    addFavorite({ freq_khz: 6000, freq_hz: 6000000, station: 'RHC', language: 'S', target: 'CAm', demod_mode: 'AM', bandwidth: 7500, notes: '' });
    addFavorite({ freq_khz: 9700, freq_hz: 9700000, station: 'VOA', language: 'E', target: 'Af', demod_mode: 'AM', bandwidth: 7500, notes: '' });

    expect(loadFavorites()).toHaveLength(3);
  });

  it('removing one favorite does not affect others', () => {
    const f1 = addFavorite({ freq_khz: 9500, freq_hz: 9500000, station: 'CRI', language: 'E', target: 'NAm', demod_mode: 'AM', bandwidth: 7500, notes: '' });
    addFavorite({ freq_khz: 6000, freq_hz: 6000000, station: 'RHC', language: 'S', target: 'CAm', demod_mode: 'AM', bandwidth: 7500, notes: '' });

    removeFavorite(f1.id);
    const remaining = loadFavorites();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].station).toBe('RHC');
  });
});
