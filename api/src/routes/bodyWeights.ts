import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { ok, fail } from '../lib/respond';
import { bodyWeightSchema, isoDateSchema, firstError } from '../lib/validation';
import {
  listBodyWeights,
  upsertBodyWeight,
  deleteBodyWeight,
} from '../db/bodyWeights';

export const bodyWeightsRouter = Router();

bodyWeightsRouter.use(requireAuth);

/** Parse a positive-integer :id param, or null if invalid. */
function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /body-weights[?from=YYYY-MM-DD&to=YYYY-MM-DD] — weigh-ins oldest→newest.
bodyWeightsRouter.get('/', (req, res) => {
  let from: string | undefined;
  let to: string | undefined;
  if (req.query.from !== undefined || req.query.to !== undefined) {
    const f = isoDateSchema.safeParse(req.query.from);
    const t = isoDateSchema.safeParse(req.query.to);
    if (!f.success || !t.success) {
      return fail(res, 400, 'from and to must both be YYYY-MM-DD dates');
    }
    from = f.data;
    to = t.data;
  }
  return ok(res, listBodyWeights(req.user!.id, from, to));
});

// POST /body-weights — log today's (or any date's) weight; replaces an existing
// entry for the same date.
bodyWeightsRouter.post('/', (req, res) => {
  const parsed = bodyWeightSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, firstError(parsed.error));

  const row = upsertBodyWeight(req.user!.id, {
    date: parsed.data.date,
    weight_kg: parsed.data.weight_kg,
    note: parsed.data.note ?? null,
  });
  return ok(res, row, 201);
});

// DELETE /body-weights/:id — remove a weigh-in.
bodyWeightsRouter.delete('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return fail(res, 400, 'Invalid id');

  const deleted = deleteBodyWeight(req.user!.id, id);
  if (!deleted) return fail(res, 404, 'Weigh-in not found');
  return ok(res, { deleted: true });
});
