import rateLimit from 'express-rate-limit';
import { config } from '../config';

// Brute-force protection for credential endpoints (login/register/password/email/delete).
// Keyed by client IP. Behind Caddy, `trust proxy` (set in app.ts) makes the
// real client IP available.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: 'Too many attempts. Please try again later.' },
  // Don't throttle the test suite (many auth calls from one IP).
  skip: () => config.isTest,
});
