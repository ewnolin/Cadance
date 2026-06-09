import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { ok, fail } from '../lib/respond';
import {
  catalogEntrySchema,
  firstError,
  MUSCLE_GROUPS,
  EQUIPMENT_TYPES,
  EXERCISE_CATEGORIES,
} from '../lib/validation';
import { listExercisesByUser, distinctExerciseNames } from '../db/exercises';
import { listCatalog, createCatalogEntry } from '../db/exerciseCatalog';

export const exercisesRouter = Router();

exercisesRouter.use(requireAuth);

// Read-only views over exercises (which are created/edited via their workout).

// GET /exercises/names — distinct exercise names for autocomplete.
// Declared before any param routes (there are none here, but keep the order).
exercisesRouter.get('/names', (req, res) => {
  return ok(res, distinctExerciseNames(req.user!.id));
});

// GET /exercises/muscles — the fixed muscle-group taxonomy, plus the equipment
// and category vocabularies, for building catalog filters in the UI.
exercisesRouter.get('/muscles', (_req, res) => {
  return ok(res, {
    muscles: MUSCLE_GROUPS,
    equipment: EQUIPMENT_TYPES,
    categories: EXERCISE_CATEGORIES,
  });
});

// GET /exercises/catalog[?muscle=&q=&equipment=&category=] — the shared exercise
// library (public entries + the user's own), filtered, sorted by name.
exercisesRouter.get('/catalog', (req, res) => {
  const str = (v: unknown) =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined;

  const muscle = str(req.query.muscle);
  if (muscle && !(MUSCLE_GROUPS as readonly string[]).includes(muscle)) {
    return fail(res, 400, 'Invalid muscle group');
  }
  const equipment = str(req.query.equipment);
  if (equipment && !(EQUIPMENT_TYPES as readonly string[]).includes(equipment)) {
    return fail(res, 400, 'Invalid equipment');
  }
  const category = str(req.query.category);
  if (
    category &&
    !(EXERCISE_CATEGORIES as readonly string[]).includes(category)
  ) {
    return fail(res, 400, 'Invalid category');
  }

  return ok(
    res,
    listCatalog(req.user!.id, { muscle, q: str(req.query.q), equipment, category })
  );
});

// POST /exercises/catalog — add a custom (private) exercise to your library.
exercisesRouter.post('/catalog', (req, res) => {
  const parsed = catalogEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, firstError(parsed.error));
  }
  return ok(res, createCatalogEntry(req.user!.id, parsed.data), 201);
});

// GET /exercises[?name=Bench Press] — per-exercise history across workouts,
// each row carrying its workout's date (newest first).
exercisesRouter.get('/', (req, res) => {
  const raw = req.query.name;
  const name = typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
  return ok(res, listExercisesByUser(req.user!.id, name));
});
