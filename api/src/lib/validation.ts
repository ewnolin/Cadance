import { z } from 'zod';

// Normalize emails (trim + lowercase) before validating their format.
const emailField = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.email('A valid email address is required').max(254)
);

// Length is the primary strength lever (NIST 800-63B). We allow the full range
// up to argon2's practical input size and don't impose arbitrary composition rules.
const passwordField = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters');

export const credentialsSchema = z.object({
  email: emailField,
  password: passwordField,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordField,
});

export const changeEmailSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

// Workout date is a calendar date (YYYY-MM-DD), not a timestamp.
const workoutDateField = z.iso.date('Date must be in YYYY-MM-DD format');
const notesField = z.string().trim().max(2000).optional();

export const workoutSchema = z.object({
  date: workoutDateField,
  notes: notesField,
});

/** First human-readable message from a failed safeParse. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input';
}
