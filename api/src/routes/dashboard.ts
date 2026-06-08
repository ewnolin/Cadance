import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { ok, fail } from '../lib/respond';
import { buildDashboard } from '../db/dashboard';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

// GET /dashboard[?days=7] — summary, streaks, and per-day breakdown for the
// trailing window (default 7 days, max 31).
dashboardRouter.get('/', (req, res) => {
  let days = 7;
  if (typeof req.query.days === 'string') {
    const n = Number(req.query.days);
    if (!Number.isInteger(n) || n < 1 || n > 31) {
      return fail(res, 400, 'days must be an integer between 1 and 31');
    }
    days = n;
  }
  return ok(res, buildDashboard(req.user!.id, days));
});
