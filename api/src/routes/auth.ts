import { Router } from 'express';
import type { Request } from 'express';
import { authLimiter } from '../middleware/rateLimit';
import { requireAuth } from '../middleware/requireAuth';
import { ok, fail } from '../lib/respond';
import { credentialsSchema, firstError } from '../lib/validation';
import {
  hashPassword,
  verifyPassword,
  getDummyHash,
} from '../lib/password';
import {
  createUser,
  getUserByEmail,
  getUserById,
  toPublicUser,
} from '../db/users';
import { createDefaultProfile } from '../db/profiles';

export const authRouter = Router();

/** Promisified session.regenerate — prevents session fixation on login/register. */
function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

// POST /auth/register — create an account and start a session.
authRouter.post('/register', authLimiter, async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, firstError(parsed.error));
  }
  const { email, password } = parsed.data;

  if (getUserByEmail(email)) {
    return fail(res, 409, 'That email is already registered.');
  }

  const passwordHash = await hashPassword(password);

  let id: number;
  try {
    id = createUser(email, passwordHash);
  } catch {
    // UNIQUE race — treat as conflict.
    return fail(res, 409, 'That email is already registered.');
  }

  // Give every new account a default public profile for content attribution.
  createDefaultProfile(id);

  await regenerateSession(req);
  req.session.userId = id;

  const user = getUserById(id)!;
  return ok(res, toPublicUser(user), 201);
});

// POST /auth/login — verify credentials and start a session.
authRouter.post('/login', authLimiter, async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, firstError(parsed.error));
  }
  const { email, password } = parsed.data;

  const user = getUserByEmail(email);
  // Always run a verify (against a dummy hash when the user is missing) to keep
  // response timing constant regardless of whether the email exists.
  const hashToCheck = user ? user.password_hash : await getDummyHash();
  const valid = await verifyPassword(hashToCheck, password);

  if (!user || !valid) {
    // Generic message — do not reveal which field was wrong.
    return fail(res, 401, 'Invalid email or password.');
  }

  await regenerateSession(req);
  req.session.userId = user.id;

  return ok(res, toPublicUser(user));
});

// POST /auth/logout — destroy the session.
authRouter.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    res.clearCookie('cadance.sid');
    if (err) {
      return fail(res, 500, 'Logout failed.');
    }
    return ok(res, { loggedOut: true });
  });
});

// GET /auth/me — current authenticated user.
authRouter.get('/me', requireAuth, (req, res) => {
  return ok(res, toPublicUser(req.user!));
});
