import { Router } from 'express';
import type { Request } from 'express';
import { authLimiter } from '../middleware/rateLimit';
import { requireAuth } from '../middleware/requireAuth';
import { ok, fail } from '../lib/respond';
import {
  changePasswordSchema,
  changeEmailSchema,
  deleteAccountSchema,
  firstError,
} from '../lib/validation';
import { hashPassword, verifyPassword } from '../lib/password';
import {
  getUserByEmail,
  getUserById,
  updatePassword,
  updateEmail,
  deleteUser,
  toPublicUser,
} from '../db/users';
import { listWorkouts } from '../db/workouts';
import { listFoodLogs } from '../db/foodLogs';
import { listTemplates } from '../db/workoutTemplates';
import { listCatalog } from '../db/exerciseCatalog';

export const accountRouter = Router();

// All routes here require an authenticated session.
accountRouter.use(requireAuth);

/** Promisified session.regenerate (keeps the user logged in, new session id). */
function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

// POST /account/change-password — requires the current password.
accountRouter.post('/change-password', authLimiter, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, firstError(parsed.error));
  }
  const { currentPassword, newPassword } = parsed.data;
  const user = req.user!;

  const valid = await verifyPassword(user.password_hash, currentPassword);
  if (!valid) {
    return fail(res, 403, 'Current password is incorrect.');
  }

  const newHash = await hashPassword(newPassword);
  updatePassword(user.id, newHash);

  // Rotate the session id after a credential change.
  await regenerateSession(req);
  req.session.userId = user.id;

  return ok(res, { passwordChanged: true });
});

// POST /account/change-email — requires the account password.
accountRouter.post('/change-email', authLimiter, async (req, res) => {
  const parsed = changeEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, firstError(parsed.error));
  }
  const { email, password } = parsed.data;
  const user = req.user!;

  const valid = await verifyPassword(user.password_hash, password);
  if (!valid) {
    return fail(res, 403, 'Password is incorrect.');
  }

  const existing = getUserByEmail(email);
  if (existing && existing.id !== user.id) {
    return fail(res, 409, 'That email is already registered.');
  }

  updateEmail(user.id, email);
  return ok(res, toPublicUser(getUserById(user.id)!));
});

// GET /account/export — GDPR data portability (Art. 20). Returns everything we
// hold about the user as a downloadable JSON document.
accountRouter.get('/export', (req, res) => {
  const user = req.user!;
  const exportPayload = {
    exported_at: new Date().toISOString(),
    account: toPublicUser(user),
    workouts: listWorkouts(user.id),
    food_logs: listFoodLogs(user.id),
    workout_templates: listTemplates(user.id),
    // Only the user's own custom catalog entries — public seeds aren't their data.
    custom_exercises: listCatalog(user.id).filter(
      (e) => e.created_by === user.id
    ),
  };

  res.setHeader(
    'Content-Disposition',
    'attachment; filename="cadance-data-export.json"'
  );
  return ok(res, exportPayload);
});

// DELETE /account — GDPR right to erasure (Art. 17). Requires the password,
// hard-deletes the user (related rows cascade), and ends the session.
accountRouter.delete('/', authLimiter, async (req, res) => {
  const parsed = deleteAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, firstError(parsed.error));
  }
  const user = req.user!;

  const valid = await verifyPassword(user.password_hash, parsed.data.password);
  if (!valid) {
    return fail(res, 403, 'Password is incorrect.');
  }

  deleteUser(user.id);

  req.session.destroy((err) => {
    res.clearCookie('cadance.sid');
    if (err) {
      return fail(res, 500, 'Account deleted, but session cleanup failed.');
    }
    return ok(res, { deleted: true });
  });
});
