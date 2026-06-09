import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';
import { ok, fail } from '../lib/respond';
import { workoutSchema, firstError, WORKOUT_TYPES } from '../lib/validation';
import {
  listWorkouts,
  getWorkout,
  createWorkout,
  updateWorkout,
  deleteWorkout,
  type WorkoutType,
  type WorkoutInput,
} from '../db/workouts';

export const workoutsRouter = Router();

// All workout routes require an authenticated session.
workoutsRouter.use(requireAuth);

/** Parse a positive-integer :id param, or null if invalid. */
function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Map validated request body to the DB input shape. */
function toInput(data: z.infer<typeof workoutSchema>): WorkoutInput {
  const base = {
    type: data.type,
    date: data.date,
    duration_s: data.duration_s ?? null,
    notes: data.notes ?? null,
    feel: data.feel ?? null,
  };
  if (data.type === 'strength') {
    // Exercises are stored as rows; no details JSON for strength.
    return { ...base, details: null, exercises: data.exercises };
  }
  return { ...base, details: data.details };
}

// GET /workouts[?type=run] — list the user's workouts (newest first).
workoutsRouter.get('/', (req, res) => {
  const typeParam = req.query.type;
  let type: WorkoutType | undefined;
  if (typeof typeParam === 'string') {
    if (!(WORKOUT_TYPES as readonly string[]).includes(typeParam)) {
      return fail(res, 400, 'Invalid workout type');
    }
    type = typeParam as WorkoutType;
  }
  return ok(res, listWorkouts(req.user!.id, type));
});

// POST /workouts — create a workout of any type.
workoutsRouter.post('/', (req, res) => {
  const parsed = workoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, firstError(parsed.error));
  }
  const workout = createWorkout(req.user!.id, toInput(parsed.data));
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

  const workout = updateWorkout(req.user!.id, id, toInput(parsed.data));
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
