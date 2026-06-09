import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';
import { ok, fail } from '../lib/respond';
import { workoutTemplateSchema, firstError } from '../lib/validation';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setTemplateVisibility,
  type WorkoutTemplateInput,
} from '../db/workoutTemplates';
import { getCatalogEntry } from '../db/exerciseCatalog';

export const workoutTemplatesRouter = Router();

workoutTemplatesRouter.use(requireAuth);

/** Parse a positive-integer :id param, or null if invalid. */
function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Map validated body to the DB input shape. */
function toInput(data: z.infer<typeof workoutTemplateSchema>): WorkoutTemplateInput {
  return {
    name: data.name,
    notes: data.notes ?? null,
    exercises: data.exercises.map((e) => ({
      name: e.name,
      catalog_id: e.catalog_id ?? null,
      target_sets: e.target_sets ?? null,
      target_reps: e.target_reps ?? null,
      notes: e.notes ?? null,
    })),
  };
}

/**
 * Every referenced catalog_id must point at an entry the user can see (a public
 * seed or their own). Returns false on the first dangling/foreign reference.
 */
function catalogRefsValid(userId: number, input: WorkoutTemplateInput): boolean {
  for (const ex of input.exercises) {
    if (ex.catalog_id != null && !getCatalogEntry(userId, ex.catalog_id)) {
      return false;
    }
  }
  return true;
}

// GET /workout-templates — the user's templates (with exercises), A→Z by name.
workoutTemplatesRouter.get('/', (req, res) => {
  return ok(res, listTemplates(req.user!.id));
});

// POST /workout-templates — create a template.
workoutTemplatesRouter.post('/', (req, res) => {
  const parsed = workoutTemplateSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, firstError(parsed.error));

  const input = toInput(parsed.data);
  if (!catalogRefsValid(req.user!.id, input)) {
    return fail(res, 400, 'Unknown catalog exercise');
  }
  return ok(res, createTemplate(req.user!.id, input), 201);
});

// GET /workout-templates/:id — one template the user owns.
workoutTemplatesRouter.get('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return fail(res, 400, 'Invalid template id');

  const template = getTemplate(req.user!.id, id);
  if (!template) return fail(res, 404, 'Template not found');
  return ok(res, template);
});

// PUT /workout-templates/:id — replace a template's fields and exercises.
workoutTemplatesRouter.put('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return fail(res, 400, 'Invalid template id');

  const parsed = workoutTemplateSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, firstError(parsed.error));

  const input = toInput(parsed.data);
  if (!catalogRefsValid(req.user!.id, input)) {
    return fail(res, 400, 'Unknown catalog exercise');
  }
  const template = updateTemplate(req.user!.id, id, input);
  if (!template) return fail(res, 404, 'Template not found');
  return ok(res, template);
});

// POST /workout-templates/:id/publish — share this template to the public library.
workoutTemplatesRouter.post('/:id/publish', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return fail(res, 400, 'Invalid template id');

  const template = setTemplateVisibility(req.user!.id, id, true);
  if (!template) return fail(res, 404, 'Template not found');
  return ok(res, template);
});

// POST /workout-templates/:id/unpublish — remove it from the public library.
workoutTemplatesRouter.post('/:id/unpublish', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return fail(res, 400, 'Invalid template id');

  const template = setTemplateVisibility(req.user!.id, id, false);
  if (!template) return fail(res, 404, 'Template not found');
  return ok(res, template);
});

// DELETE /workout-templates/:id — remove a template (exercises cascade).
workoutTemplatesRouter.delete('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return fail(res, 400, 'Invalid template id');

  const deleted = deleteTemplate(req.user!.id, id);
  if (!deleted) return fail(res, 404, 'Template not found');
  return ok(res, { deleted: true });
});
