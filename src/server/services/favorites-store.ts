import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Favorite } from '../../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FAVORITES_PATH = path.resolve(__dirname, '../../../data/favorites.json');

export function loadFavorites(): Favorite[] {
  try {
    return JSON.parse(fs.readFileSync(FAVORITES_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveFavorites(favs: Favorite[]): void {
  const dir = path.dirname(FAVORITES_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(FAVORITES_PATH, JSON.stringify(favs, null, 2), 'utf-8');
}

export function addFavorite(
  data: Omit<Favorite, 'id' | 'added_at'>
): Favorite {
  const favs = loadFavorites();
  const fav: Favorite = {
    id: crypto.randomUUID(),
    ...data,
    added_at: new Date().toISOString(),
  };
  favs.push(fav);
  saveFavorites(favs);
  return fav;
}

export function removeFavorite(id: string): boolean {
  const favs = loadFavorites();
  const filtered = favs.filter(f => f.id !== id);
  if (filtered.length === favs.length) return false;
  saveFavorites(filtered);
  return true;
}

export function findFavorite(
  freq_khz: number,
  station: string
): Favorite | undefined {
  const favs = loadFavorites();
  return favs.find(f => f.freq_khz === freq_khz && f.station === station);
}
