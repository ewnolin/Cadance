import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { ok } from '../lib/respond';
import { buildStats } from '../db/stats';

export const statsRouter = Router();

statsRouter.use(requireAuth);

// GET /stats — all-time workout count, sets this week, a 6-week activity
// breakdown, and per-exercise personal records (heaviest set + est. 1RM).
statsRouter.get('/', (req, res) => {
  return ok(res, buildStats(req.user!.id));
});
