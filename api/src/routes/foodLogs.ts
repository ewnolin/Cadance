import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { ok, fail } from '../lib/respond';
import { foodLogSchema, isoDateSchema, firstError } from '../lib/validation';
import {
  listFoodLogs,
  getFoodLog,
  createFoodLog,
  updateFoodLog,
  deleteFoodLog,
  summarizeByDate,
} from '../db/foodLogs';

export const foodLogsRouter = Router();

// All food-log routes require an authenticated session.
foodLogsRouter.use(requireAuth);

/** Parse a positive-integer :id param, or null if invalid. */
function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Today's date as YYYY-MM-DD. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// GET /food-logs/summary[?date=YYYY-MM-DD] — daily nutrition totals.
// Declared before /:id so "summary" isn't swallowed by the id route.
foodLogsRouter.get('/summary', (req, res) => {
  const raw = typeof req.query.date === 'string' ? req.query.date : today();
  const parsed = isoDateSchema.safeParse(raw);
  if (!parsed.success) return fail(res, 400, firstError(parsed.error));
  return ok(res, summarizeByDate(req.user!.id, parsed.data));
});

// GET /food-logs[?date=YYYY-MM-DD] — list the user's food logs.
foodLogsRouter.get('/', (req, res) => {
  let date: string | undefined;
  if (typeof req.query.date === 'string') {
    const parsed = isoDateSchema.safeParse(req.query.date);
    if (!parsed.success) return fail(res, 400, firstError(parsed.error));
    date = parsed.data;
  }
  return ok(res, listFoodLogs(req.user!.id, date));
});

// POST /food-logs — create a food log entry.
foodLogsRouter.post('/', (req, res) => {
  const parsed = foodLogSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, firstError(parsed.error));
  return ok(res, createFoodLog(req.user!.id, parsed.data), 201);
});

// GET /food-logs/:id — fetch one entry the user owns.
foodLogsRouter.get('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return fail(res, 400, 'Invalid food log id');

  const log = getFoodLog(req.user!.id, id);
  if (!log) return fail(res, 404, 'Food log not found');
  return ok(res, log);
});

// PUT /food-logs/:id — replace an entry's fields.
foodLogsRouter.put('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return fail(res, 400, 'Invalid food log id');

  const parsed = foodLogSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, firstError(parsed.error));

  const log = updateFoodLog(req.user!.id, id, parsed.data);
  if (!log) return fail(res, 404, 'Food log not found');
  return ok(res, log);
});

// DELETE /food-logs/:id — remove an entry.
foodLogsRouter.delete('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return fail(res, 400, 'Invalid food log id');

  const deleted = deleteFoodLog(req.user!.id, id);
  if (!deleted) return fail(res, 404, 'Food log not found');
  return ok(res, { deleted: true });
});
