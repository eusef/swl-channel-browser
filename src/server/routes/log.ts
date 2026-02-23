import { Router, Request, Response } from 'express';
import {
  loadLog,
  addLogEntry,
  removeLogEntry,
  exportCsv,
} from '../services/log-store.js';

const router = Router();

// List all log entries (newest first)
router.get('/', (_req: Request, res: Response) => {
  const entries = loadLog();
  entries.sort((a, b) => b.logged_at.localeCompare(a.logged_at));
  res.json(entries);
});

// Add a log entry
router.post('/', (req: Request, res: Response) => {
  const { freq_khz, station, language, target, signal_power, signal_snr, notes } = req.body;

  if (!freq_khz || !station) {
    res.status(400).json({ error: 'freq_khz and station are required' });
    return;
  }

  const entry = addLogEntry({
    freq_khz,
    station,
    language: language || '',
    target: target || '',
    signal_power: signal_power ?? null,
    signal_snr: signal_snr ?? null,
    notes: notes || '',
  });
  res.status(201).json(entry);
});

// Export log as CSV
router.get('/export', (_req: Request, res: Response) => {
  const csv = exportCsv();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="reception-log.csv"');
  res.send(csv);
});

// Delete a log entry
router.delete('/:id', (req: Request, res: Response) => {
  const removed = removeLogEntry(req.params.id);
  if (!removed) {
    res.status(404).json({ error: 'Log entry not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
