import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { ok, fail } from '../lib/respond';
import { profileSchema, firstError } from '../lib/validation';
import { getOrCreateProfile, updateProfile } from '../db/profiles';

export const profileRouter = Router();

profileRouter.use(requireAuth);

// GET /profile — the current user's public profile (created on first access if
// it somehow doesn't exist yet).
profileRouter.get('/', (req, res) => {
  return ok(res, getOrCreateProfile(req.user!.id));
});

// PUT /profile — update display name / bio.
profileRouter.put('/', (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, firstError(parsed.error));

  return ok(
    res,
    updateProfile(req.user!.id, {
      display_name: parsed.data.display_name,
      bio: parsed.data.bio ?? null,
    })
  );
});
