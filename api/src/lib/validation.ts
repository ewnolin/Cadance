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

// ---- Workouts (polymorphic by `type`) ----

// Workout date is a calendar date (YYYY-MM-DD), not a timestamp.
const workoutDateField = z.iso.date('Date must be in YYYY-MM-DD format');
const notesField = z.string().trim().max(2000).optional();
const durationField = z.number().int().positive().nullish();

// Fields shared by every workout type.
const baseFields = {
  date: workoutDateField,
  duration_s: durationField,
  notes: notesField,
};

// Type-specific detail payloads. Adding a new activity is a matter of adding a
// details schema + a variant below — no migration, no new route.
const strengthDetails = z.object({
  exercises: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        sets: z
          .array(
            z.object({
              reps: z.number().int().nonnegative(),
              weight_kg: z.number().nonnegative(),
            })
          )
          .max(50),
      })
    )
    .max(50),
});

// run + cycle share the same cardio shape.
const cardioDetails = z.object({
  distance_km: z.number().positive(),
  elevation_m: z.number().optional(),
  route_geojson: z.unknown().optional(),
});

const yogaDetails = z.object({
  style: z.string().trim().min(1).max(80),
  intensity: z.enum(['gentle', 'moderate', 'power']),
});

export const WORKOUT_TYPES = ['strength', 'run', 'cycle', 'yoga'] as const;

export const workoutSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('strength'), ...baseFields, details: strengthDetails }),
  z.object({ type: z.literal('run'), ...baseFields, details: cardioDetails }),
  z.object({ type: z.literal('cycle'), ...baseFields, details: cardioDetails }),
  z.object({ type: z.literal('yoga'), ...baseFields, details: yogaDetails }),
]);

/** First human-readable message from a failed safeParse. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input';
}
