import { db } from './index';
import { getCatalogEntriesByIds } from './exerciseCatalog';

export interface ExerciseSet {
  reps: number;
  weight_kg: number;
  rpe?: number | null; // Rate of Perceived Exertion (1–10), when recorded
}

export interface ExerciseInput {
  name: string;
  catalog_id?: number | null;
  sets: ExerciseSet[];
}

export interface Exercise {
  id: number;
  workout_id: number;
  user_id: number;
  catalog_id: number | null;
  name: string;
  position: number;
  sets: ExerciseSet[];
  created_at: string;
  updated_at: string;
}

interface ExerciseDbRow {
  id: number;
  workout_id: number;
  user_id: number;
  catalog_id: number | null;
  name: string;
  position: number;
  sets: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: ExerciseDbRow): Exercise {
  return { ...row, sets: row.sets ? (JSON.parse(row.sets) as ExerciseSet[]) : [] };
}

/** Exercises belonging to one workout, in order. */
export function listExercisesForWorkout(workoutId: number): Exercise[] {
  return (
    db
      .prepare(
        'SELECT * FROM exercises WHERE workout_id = ? ORDER BY position ASC, id ASC'
      )
      .all(workoutId) as ExerciseDbRow[]
  ).map(mapRow);
}

export function deleteExercisesForWorkout(workoutId: number): void {
  db.prepare('DELETE FROM exercises WHERE workout_id = ?').run(workoutId);
}

/** Insert exercises for a workout, numbering position by array order. */
export function insertExercises(
  workoutId: number,
  userId: number,
  exercises: ExerciseInput[]
): void {
  const now = new Date().toISOString();
  // Alias merging: when an exercise is linked to the catalog, store the catalog
  // entry's canonical name so the same lift logged under different spellings (or
  // a template's custom label) groups together in history, PRs and recommendations.
  const catalog = getCatalogEntriesByIds(
    exercises
      .map((e) => e.catalog_id)
      .filter((id): id is number => id != null)
  );
  const stmt = db.prepare(
    `INSERT INTO exercises (workout_id, user_id, catalog_id, name, position, sets, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  exercises.forEach((ex, i) => {
    const canonicalName =
      ex.catalog_id != null
        ? catalog.get(ex.catalog_id)?.name ?? ex.name
        : ex.name;
    stmt.run(
      workoutId,
      userId,
      ex.catalog_id ?? null,
      canonicalName,
      i,
      JSON.stringify(ex.sets),
      now,
      now
    );
  });
}

/**
 * Cross-workout exercise history for a user, each row carrying its workout's
 * date. Optional case-insensitive name filter — this is the per-exercise
 * progress query (e.g. "Bench Press over time").
 */
export function listExercisesByUser(
  userId: number,
  name?: string
): Array<Exercise & { date: string }> {
  const rows = (
    name
      ? db
          .prepare(
            `SELECT e.*, w.date AS date FROM exercises e
             JOIN workouts w ON w.id = e.workout_id
             WHERE e.user_id = ? AND e.name = ? COLLATE NOCASE
             ORDER BY w.date DESC, e.id DESC`
          )
          .all(userId, name)
      : db
          .prepare(
            `SELECT e.*, w.date AS date FROM exercises e
             JOIN workouts w ON w.id = e.workout_id
             WHERE e.user_id = ?
             ORDER BY w.date DESC, e.id DESC`
          )
          .all(userId)
  ) as Array<ExerciseDbRow & { date: string }>;
  return rows.map((r) => ({ ...mapRow(r), date: r.date }));
}

/** Distinct exercise names the user has logged (for autocomplete). Case
 * variants of the same name collapse to a single representative. */
export function distinctExerciseNames(userId: number): string[] {
  return (
    db
      .prepare(
        `SELECT name FROM exercises WHERE user_id = ?
         GROUP BY name COLLATE NOCASE ORDER BY name COLLATE NOCASE`
      )
      .all(userId) as { name: string }[]
  ).map((r) => r.name);
}
