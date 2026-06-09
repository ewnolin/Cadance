import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { ok } from '../lib/respond';
import { listExercisesByUser, distinctExerciseNames } from '../db/exercises';

export const exercisesRouter = Router();

exercisesRouter.use(requireAuth);

// Read-only views over exercises (which are created/edited via their workout).

// GET /exercises/names — distinct exercise names for autocomplete.
// Declared before any param routes (there are none here, but keep the order).
exercisesRouter.get('/names', (req, res) => {
  return ok(res, distinctExerciseNames(req.user!.id));
});

// GET /exercises[?name=Bench Press] — per-exercise history across workouts,
// each row carrying its workout's date (newest first).
exercisesRouter.get('/', (req, res) => {
  const raw = req.query.name;
  const name = typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
  return ok(res, listExercisesByUser(req.user!.id, name));
});
