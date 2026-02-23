import { Router, Request, Response } from 'express';
import { fetchPropagation } from '../services/propagation.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const data = await fetchPropagation();
    res.json(data);
  } catch (err) {
    console.error('[Propagation Route] Error:', err);
    res.status(500).json({ error: 'Failed to fetch propagation data' });
  }
});

export default router;
