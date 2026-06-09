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

// How a session subjectively went / how hard it was — a single, type-agnostic
// rating (strength, cardio and yoga all use it). Provisional vocabulary; the
// "strong/spent" axis some lifters expect differs from cardio intensity, so this
// may grow later.
export const WORKOUT_FEELS = ['easy', 'moderate', 'hard', 'max'] as const;
export type WorkoutFeel = (typeof WORKOUT_FEELS)[number];
const feelField = z.enum(WORKOUT_FEELS).nullish();

// Fields shared by every workout type.
const baseFields = {
  date: workoutDateField,
  duration_s: durationField,
  notes: notesField,
  feel: feelField,
};

// Strength workouts carry exercises (stored as first-class rows, not in details).
const setSchema = z.object({
  reps: z.number().int().nonnegative(),
  weight_kg: z.number().nonnegative(),
  // Rate of Perceived Exertion, 1–10 in half steps. Optional — logged per set
  // when the lifter records it, omitted otherwise.
  rpe: z.number().min(1).max(10).multipleOf(0.5).nullish(),
});
const exerciseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sets: z.array(setSchema).max(50),
});

// Type-specific detail payloads for non-strength types. Adding a new activity is
// a matter of adding a details schema + a variant below — no migration, no new route.

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
  z.object({ type: z.literal('strength'), ...baseFields, exercises: z.array(exerciseSchema).max(50) }),
  z.object({ type: z.literal('run'), ...baseFields, details: cardioDetails }),
  z.object({ type: z.literal('cycle'), ...baseFields, details: cardioDetails }),
  z.object({ type: z.literal('yoga'), ...baseFields, details: yogaDetails }),
]);

// ---- Food logs ----

// YYYY-MM-DD, reused for query params too.
export const isoDateSchema = z.iso.date('Date must be in YYYY-MM-DD format');
export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export const foodLogSchema = z.object({
  date: workoutDateField,
  meal: z.enum(MEAL_TYPES),
  name: z.string().trim().min(1).max(200),
  calories: z.number().int().nonnegative(),
  // Macros in grams; omitted ones default to 0 so you can log calories alone.
  protein: z.number().nonnegative().default(0),
  carbs: z.number().nonnegative().default(0),
  fat: z.number().nonnegative().default(0),
});

// ---- Exercise catalog (muscle-group taxonomy) ----

// A fixed, curated taxonomy. Granular enough to drive library filtering and
// weak-area recommendations, but closed so the data stays comparable across
// exercises. Adding a muscle is a deliberate, app-wide decision (and a migration
// concern for any persisted analytics), not a free-text field.
export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'lats',
  'traps',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

// Compound (multi-joint) vs isolation (single-joint) — drives ordering hints
// ("open with a compound") in recommendations later.
export const EXERCISE_CATEGORIES = ['compound', 'isolation'] as const;

export const EQUIPMENT_TYPES = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'other',
] as const;

const muscleField = z.enum(MUSCLE_GROUPS);

// Body of a user-created (custom) catalog entry. Seeded/global entries are
// inserted by the migration, not this schema.
export const catalogEntrySchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(EXERCISE_CATEGORIES).default('compound'),
  equipment: z.enum(EQUIPMENT_TYPES).default('other'),
  // At least one primary muscle; de-duplicated so counts don't double up.
  primary_muscles: z
    .array(muscleField)
    .min(1, 'At least one primary muscle is required')
    .transform((m) => [...new Set(m)]),
  secondary_muscles: z
    .array(muscleField)
    .default([])
    .transform((m) => [...new Set(m)]),
});

// ---- Workout templates (reusable preset workouts) ----

// One prescribed exercise within a template. `catalog_id` optionally links to a
// shared catalog entry (existence/visibility checked in the route); `name` is
// always stored so the template reads correctly even if that entry is removed.
const templateExerciseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  catalog_id: z.number().int().positive().nullish(),
  target_sets: z.number().int().positive().max(50).nullish(),
  target_reps: z.string().trim().max(40).nullish(),
  notes: z.string().trim().max(200).nullish(),
});

export const workoutTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(2000).nullish(),
  exercises: z.array(templateExerciseSchema).max(50).default([]),
});

// ---- Public profile ----

export const profileSchema = z.object({
  display_name: z.string().trim().min(1, 'Display name is required').max(50),
  bio: z.string().trim().max(300).nullish(),
});

/** First human-readable message from a failed safeParse. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input';
}
