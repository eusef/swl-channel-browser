import { Router, Request, Response } from 'express';
import { getNow, getUpcoming, getNearby, search, getAvailableFilters, loadBroadcasts, getBroadcastCount, getScheduleStatus } from '../services/schedule-store.js';
import { fetchEibiCsv, getCachedCsv } from '../services/eibi-fetcher.js';
import { parseEibiCsv } from '../services/eibi-parser.js';
import { getCurrentUtcDisplay } from '../lib/time.js';
import { ScheduleFilters } from '../../shared/types.js';

const router = Router();

router.get('/now', (req: Request, res: Response) => {
  const filters: ScheduleFilters = {
    band: req.query.band as string | undefined,
    lang: req.query.lang as string | undefined,
    target: req.query.target as string | undefined,
    q: req.query.q as string | undefined,
    sort: req.query.sort as string | undefined,
    order: req.query.order as 'asc' | 'desc' | undefined,
  };

  const broadcasts = getNow(filters);
  res.json({
    count: broadcasts.length,
    utc_time: getCurrentUtcDisplay(),
    broadcasts,
  });
});

router.get('/upcoming', (req: Request, res: Response) => {
  const hours = Math.min(parseInt(req.query.hours as string) || 3, 24);
  const filters: ScheduleFilters = {
    band: req.query.band as string | undefined,
    lang: req.query.lang as string | undefined,
    target: req.query.target as string | undefined,
  };

  const broadcasts = getUpcoming(hours, filters);
  res.json({
    count: broadcasts.length,
    utc_time: getCurrentUtcDisplay(),
    broadcasts,
  });
});

router.get('/nearby', (req: Request, res: Response) => {
  const freqKhz = parseFloat(req.query.freq_khz as string);
  const spanKhz = parseFloat(req.query.span_khz as string) || 1000;

  if (!freqKhz || isNaN(freqKhz)) {
    res.json({ count: 0, broadcasts: [] });
    return;
  }

  const broadcasts = getNearby(freqKhz, spanKhz);
  res.json({
    count: broadcasts.length,
    center_khz: freqKhz,
    span_khz: spanKhz,
    broadcasts,
  });
});

router.get('/search', (req: Request, res: Response) => {
  const q = req.query.q as string;
  if (!q || q.length < 2) {
    res.json({ count: 0, utc_time: getCurrentUtcDisplay(), broadcasts: [] });
    return;
  }

  const broadcasts = search(q);
  res.json({
    count: broadcasts.length,
    utc_time: getCurrentUtcDisplay(),
    broadcasts,
  });
});

router.get('/status', (_req: Request, res: Response) => {
  const status = getScheduleStatus();
  const refreshHours = parseInt(process.env.EIBI_REFRESH_HOURS || '168', 10);
  res.json({
    ...status,
    refresh_interval_hours: refreshHours,
    source: 'EiBi Short-wave Schedules (eibispace.de)',
  });
});

router.post('/refresh', async (_req: Request, res: Response) => {
  try {
    const url = process.env.EIBI_CSV_URL || 'http://www.eibispace.de/dx/sked-b25.csv';
    const csv = await fetchEibiCsv(url, 0); // Force refresh
    const parsed = parseEibiCsv(csv);
    loadBroadcasts(parsed);

    res.json({
      status: 'ok',
      records_parsed: parsed.length,
      source: 'sked-b25.csv',
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;

export function getFiltersRouter() {
  const filtersRouter = Router();

  filtersRouter.get('/', (_req: Request, res: Response) => {
    res.json(getAvailableFilters());
  });

  return filtersRouter;
}
