import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { StationList, Favorite } from '../../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LISTS_PATH = path.resolve(__dirname, '../../../data/lists.json');
const FAVORITES_PATH = path.resolve(__dirname, '../../../data/favorites.json');

function ensureDir(): void {
  const dir = path.dirname(LISTS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Migrate old favorites.json into the new lists format */
function migrateFavorites(): StationList[] {
  let existingFavs: Favorite[] = [];
  try {
    existingFavs = JSON.parse(fs.readFileSync(FAVORITES_PATH, 'utf-8'));
  } catch {
    // No existing favorites
  }

  const defaultList: StationList = {
    id: crypto.randomUUID(),
    name: 'Favorites',
    created_at: new Date().toISOString(),
    stations: existingFavs,
  };

  const lists = [defaultList];
  saveLists(lists);
  return lists;
}

export function loadLists(): StationList[] {
  try {
    const data = JSON.parse(fs.readFileSync(LISTS_PATH, 'utf-8'));
    if (Array.isArray(data) && data.length > 0) return data;
    // Empty or invalid - reinitialize
    return migrateFavorites();
  } catch {
    // File doesn't exist - try migration
    return migrateFavorites();
  }
}

export function saveLists(lists: StationList[]): void {
  ensureDir();
  fs.writeFileSync(LISTS_PATH, JSON.stringify(lists, null, 2), 'utf-8');
}

export function createList(name: string): StationList {
  const lists = loadLists();
  const newList: StationList = {
    id: crypto.randomUUID(),
    name,
    created_at: new Date().toISOString(),
    stations: [],
  };
  lists.push(newList);
  saveLists(lists);
  return newList;
}

export function renameList(listId: string, name: string): StationList | null {
  const lists = loadLists();
  const list = lists.find(l => l.id === listId);
  if (!list) return null;
  list.name = name;
  saveLists(lists);
  return list;
}

export function deleteList(listId: string): boolean {
  const lists = loadLists();
  if (lists.length <= 1) return false; // Prevent deleting last list
  const filtered = lists.filter(l => l.id !== listId);
  if (filtered.length === lists.length) return false;
  saveLists(filtered);
  return true;
}

export function addStation(
  listId: string,
  data: Omit<Favorite, 'id' | 'added_at'>
): Favorite | null {
  const lists = loadLists();
  const list = lists.find(l => l.id === listId);
  if (!list) return null;

  const station: Favorite = {
    id: crypto.randomUUID(),
    ...data,
    added_at: new Date().toISOString(),
  };
  list.stations.push(station);
  saveLists(lists);
  return station;
}

export function removeStation(listId: string, stationId: string): boolean {
  const lists = loadLists();
  const list = lists.find(l => l.id === listId);
  if (!list) return false;

  const before = list.stations.length;
  list.stations = list.stations.filter(s => s.id !== stationId);
  if (list.stations.length === before) return false;

  saveLists(lists);
  return true;
}

export function moveStation(
  fromListId: string,
  toListId: string,
  stationId: string
): boolean {
  const lists = loadLists();
  const fromList = lists.find(l => l.id === fromListId);
  const toList = lists.find(l => l.id === toListId);
  if (!fromList || !toList) return false;

  const stationIdx = fromList.stations.findIndex(s => s.id === stationId);
  if (stationIdx === -1) return false;

  const [station] = fromList.stations.splice(stationIdx, 1);
  toList.stations.push(station);
  saveLists(lists);
  return true;
}

export function exportList(listId: string): StationList | null {
  const lists = loadLists();
  return lists.find(l => l.id === listId) || null;
}

export function importList(data: { name: string; stations: Omit<Favorite, 'id' | 'added_at'>[] }): StationList {
  const lists = loadLists();
  const newList: StationList = {
    id: crypto.randomUUID(),
    name: data.name || 'Imported List',
    created_at: new Date().toISOString(),
    stations: data.stations.map(s => ({
      id: crypto.randomUUID(),
      ...s,
      added_at: new Date().toISOString(),
    })),
  };
  lists.push(newList);
  saveLists(lists);
  return newList;
}

/** Find which list(s) contain a station by freq+name */
export function findStationInLists(
  freq_khz: number,
  station: string
): { listId: string; stationId: string } | undefined {
  const lists = loadLists();
  for (const list of lists) {
    const s = list.stations.find(
      f => f.freq_khz === freq_khz && f.station === station
    );
    if (s) return { listId: list.id, stationId: s.id };
  }
  return undefined;
}
