import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { ok, fail } from '../lib/respond';
import { getRecommendations } from '../db/recommendations';

export const recommendationsRouter = Router();

recommendationsRouter.use(requireAuth);

// GET /recommendations[?days=7] — per-muscle training volume over the trailing
// window, the muscles you're under-training (weak areas), and public library
// templates that target them. Window defaults to 7 days (max 31).
recommendationsRouter.get('/', (req, res) => {
  let days = 7;
  if (typeof req.query.days === 'string') {
    const n = Number(req.query.days);
    if (!Number.isInteger(n) || n < 1 || n > 31) {
      return fail(res, 400, 'days must be an integer between 1 and 31');
    }
    days = n;
  }
  return ok(res, getRecommendations(req.user!.id, days));
});
