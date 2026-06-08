import type { RequestHandler } from 'express';
import { getUserById } from '../db/users';
import { fail } from '../lib/respond';

/** Gate that requires a valid session and loads the user onto req.user. */
export const requireAuth: RequestHandler = (req, res, next) => {
  const userId = req.session.userId;
  if (!userId) {
    fail(res, 401, 'Authentication required');
    return;
  }

  const user = getUserById(userId);
  if (!user) {
    // Stale session (user deleted) — clear it.
    req.session.destroy(() => undefined);
    fail(res, 401, 'Authentication required');
    return;
  }

  req.user = user;
  next();
};
