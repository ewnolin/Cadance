import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { ok, fail } from '../lib/respond';
import { workoutSchema, firstError } from '../lib/validation';
import {
  listWorkouts,
  getWorkout,
  createWorkout,
  updateWorkout,
  deleteWorkout,
} from '../db/workouts';

export const workoutsRouter = Router();

// All workout routes require an authenticated session.
workoutsRouter.use(requireAuth);

/** Parse a positive-integer :id param, or null if invalid. */
function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /workouts — list the current user's workouts (newest first).
workoutsRouter.get('/', (req, res) => {
  return ok(res, listWorkouts(req.user!.id));
});

// POST /workouts — create a workout.
workoutsRouter.post('/', (req, res) => {
  const parsed = workoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, firstError(parsed.error));
  }
  const workout = createWorkout(req.user!.id, {
    date: parsed.data.date,
    notes: parsed.data.notes ?? null,
  });
  return ok(res, workout, 201);
});

// GET /workouts/:id — fetch one workout the user owns.
workoutsRouter.get('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return fail(res, 400, 'Invalid workout id');

  const workout = getWorkout(req.user!.id, id);
  if (!workout) return fail(res, 404, 'Workout not found');
  return ok(res, workout);
});

// PUT /workouts/:id — replace a workout's fields.
workoutsRouter.put('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return fail(res, 400, 'Invalid workout id');

  const parsed = workoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, firstError(parsed.error));
  }

  const workout = updateWorkout(req.user!.id, id, {
    date: parsed.data.date,
    notes: parsed.data.notes ?? null,
  });
  if (!workout) return fail(res, 404, 'Workout not found');
  return ok(res, workout);
});

// DELETE /workouts/:id — remove a workout.
workoutsRouter.delete('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return fail(res, 400, 'Invalid workout id');

  const deleted = deleteWorkout(req.user!.id, id);
  if (!deleted) return fail(res, 404, 'Workout not found');
  return ok(res, { deleted: true });
});
