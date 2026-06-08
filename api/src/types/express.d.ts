import type { UserRow } from '../db/users';

declare global {
  namespace Express {
    interface Request {
      // Populated by the requireAuth middleware.
      user?: UserRow;
    }
  }
}

export {};
