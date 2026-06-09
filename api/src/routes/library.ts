import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { ok, fail } from '../lib/respond';
import { MUSCLE_GROUPS } from '../lib/validation';
import {
  listPublicTemplates,
  getPublicTemplate,
  copyPublicTemplate,
} from '../db/workoutTemplates';

export const libraryRouter = Router();

// Browsing the shared library still requires an account (it's a logged-in app).
libraryRouter.use(requireAuth);

/** Parse a positive-integer :id param, or null if invalid. */
function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /library[?muscle=&q=] — published templates from everyone, with author
// attribution and the muscle groups each one trains.
libraryRouter.get('/', (req, res) => {
  const str = (v: unknown) =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined;

  const muscle = str(req.query.muscle);
  if (muscle && !(MUSCLE_GROUPS as readonly string[]).includes(muscle)) {
    return fail(res, 400, 'Invalid muscle group');
  }
  return ok(res, listPublicTemplates({ muscle, q: str(req.query.q) }));
});

// GET /library/:id — one published template (any author).
libraryRouter.get('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return fail(res, 400, 'Invalid template id');

  const template = getPublicTemplate(id);
  if (!template) return fail(res, 404, 'Template not found');
  return ok(res, template);
});

// POST /library/:id/copy — save a copy of a published template to your own.
libraryRouter.post('/:id/copy', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return fail(res, 400, 'Invalid template id');

  const copy = copyPublicTemplate(req.user!.id, id);
  if (!copy) return fail(res, 404, 'Template not found');
  return ok(res, copy, 201);
});
