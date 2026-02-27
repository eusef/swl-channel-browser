import { Router, Request, Response } from 'express';
import {
  loadLists,
  createList,
  renameList,
  deleteList,
  addStation,
  removeStation,
  moveStation,
  exportList,
  importList,
  findStationInLists,
} from '../services/lists-store.js';

const router = Router();

// Get all lists (with stations, newest first by list creation)
router.get('/', (_req: Request, res: Response) => {
  const lists = loadLists();
  res.json(lists);
});

// Create new list
router.post('/', (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const list = createList(name.trim());
  res.status(201).json(list);
});

// Rename list
router.put('/:id', (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const list = renameList(req.params.id, name.trim());
  if (!list) {
    res.status(404).json({ error: 'List not found' });
    return;
  }
  res.json(list);
});

// Delete list
router.delete('/:id', (req: Request, res: Response) => {
  const removed = deleteList(req.params.id);
  if (!removed) {
    res.status(400).json({ error: 'Cannot delete list (not found or last remaining list)' });
    return;
  }
  res.json({ success: true });
});

// Add station to list
router.post('/:id/stations', (req: Request, res: Response) => {
  const { freq_khz, freq_hz, station, language, target, demod_mode, bandwidth, notes } = req.body;
  if (!freq_khz || !station) {
    res.status(400).json({ error: 'freq_khz and station are required' });
    return;
  }
  const result = addStation(req.params.id, {
    freq_khz,
    freq_hz: freq_hz || freq_khz * 1000,
    station,
    language: language || '',
    target: target || '',
    demod_mode: demod_mode || 'SAM',
    bandwidth: bandwidth || 7500,
    notes: notes || '',
  });
  if (!result) {
    res.status(404).json({ error: 'List not found' });
    return;
  }
  res.status(201).json(result);
});

// Remove station from list
router.delete('/:id/stations/:stationId', (req: Request, res: Response) => {
  const removed = removeStation(req.params.id, req.params.stationId);
  if (!removed) {
    res.status(404).json({ error: 'Station or list not found' });
    return;
  }
  res.json({ success: true });
});

// Move station between lists
router.post('/:id/stations/:stationId/move', (req: Request, res: Response) => {
  const { targetListId } = req.body;
  if (!targetListId) {
    res.status(400).json({ error: 'targetListId is required' });
    return;
  }
  const moved = moveStation(req.params.id, targetListId, req.params.stationId);
  if (!moved) {
    res.status(404).json({ error: 'Station or list not found' });
    return;
  }
  res.json({ success: true });
});

// Export list as JSON
router.get('/:id/export', (req: Request, res: Response) => {
  const list = exportList(req.params.id);
  if (!list) {
    res.status(404).json({ error: 'List not found' });
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${list.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}.json"`);
  res.json({ name: list.name, stations: list.stations });
});

// Import list from JSON
router.post('/import', (req: Request, res: Response) => {
  const { name, stations } = req.body;
  if (!Array.isArray(stations)) {
    res.status(400).json({ error: 'stations array is required' });
    return;
  }
  const list = importList({ name: name || 'Imported List', stations });
  res.status(201).json(list);
});

// Check if a station is in any list
router.get('/check', (req: Request, res: Response) => {
  const freq_khz = parseInt(req.query.freq_khz as string, 10);
  const station = req.query.station as string;
  if (!freq_khz || !station) {
    res.status(400).json({ error: 'freq_khz and station are required' });
    return;
  }
  const result = findStationInLists(freq_khz, station);
  res.json({ inList: !!result, listId: result?.listId, stationId: result?.stationId });
});

export default router;
