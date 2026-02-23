import { Router, Request, Response } from 'express';
import {
  loadFavorites,
  addFavorite,
  removeFavorite,
  findFavorite,
} from '../services/favorites-store.js';

const router = Router();

// List all favorites (newest first)
router.get('/', (_req: Request, res: Response) => {
  const favs = loadFavorites();
  favs.sort((a, b) => b.added_at.localeCompare(a.added_at));
  res.json(favs);
});

// Add a favorite
router.post('/', (req: Request, res: Response) => {
  const { freq_khz, freq_hz, station, language, target, demod_mode, bandwidth, notes } = req.body;

  if (!freq_khz || !station) {
    res.status(400).json({ error: 'freq_khz and station are required' });
    return;
  }

  const fav = addFavorite({
    freq_khz,
    freq_hz: freq_hz || freq_khz * 1000,
    station,
    language: language || '',
    target: target || '',
    demod_mode: demod_mode || 'AM',
    bandwidth: bandwidth || 7500,
    notes: notes || '',
  });
  res.status(201).json(fav);
});

// Check if a broadcast is favorited
router.get('/check', (req: Request, res: Response) => {
  const freq_khz = parseInt(req.query.freq_khz as string, 10);
  const station = req.query.station as string;

  if (!freq_khz || !station) {
    res.status(400).json({ error: 'freq_khz and station are required' });
    return;
  }

  const fav = findFavorite(freq_khz, station);
  res.json({ isFavorite: !!fav, id: fav?.id });
});

// Delete a favorite
router.delete('/:id', (req: Request, res: Response) => {
  const removed = removeFavorite(req.params.id);
  if (!removed) {
    res.status(404).json({ error: 'Favorite not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
