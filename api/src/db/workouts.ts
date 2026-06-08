import { db } from './index';

export type WorkoutType = 'strength' | 'run' | 'cycle' | 'yoga';

// Row as stored: details is a JSON string (or null).
interface WorkoutDbRow {
  id: number;
  user_id: number;
  type: WorkoutType;
  date: string;
  duration_s: number | null;
  notes: string | null;
  details: string | null;
  created_at: string;
  updated_at: string;
}

// Row as returned by the API: details parsed into an object.
export interface Workout {
  id: number;
  user_id: number;
  type: WorkoutType;
  date: string;
  duration_s: number | null;
  notes: string | null;
  details: unknown;
  created_at: string;
  updated_at: string;
}

export interface WorkoutInput {
  type: WorkoutType;
  date: string;
  duration_s: number | null;
  notes: string | null;
  details: unknown; // already validated against the per-type schema
}

function mapRow(row: WorkoutDbRow): Workout {
  return { ...row, details: row.details ? JSON.parse(row.details) : null };
}

// Every query is scoped by user_id so a user can only ever touch their own
// workouts (prevents IDOR via guessable ids).

export function listWorkouts(userId: number, type?: WorkoutType): Workout[] {
  const rows = (
    type
      ? db
          .prepare(
            'SELECT * FROM workouts WHERE user_id = ? AND type = ? ORDER BY date DESC, id DESC'
          )
          .all(userId, type)
      : db
          .prepare(
            'SELECT * FROM workouts WHERE user_id = ? ORDER BY date DESC, id DESC'
          )
          .all(userId)
  ) as WorkoutDbRow[];
  return rows.map(mapRow);
}

export function getWorkout(userId: number, id: number): Workout | undefined {
  const row = db
    .prepare('SELECT * FROM workouts WHERE id = ? AND user_id = ?')
    .get(id, userId) as WorkoutDbRow | undefined;
  return row ? mapRow(row) : undefined;
}

export function createWorkout(userId: number, input: WorkoutInput): Workout {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO workouts (user_id, type, date, duration_s, notes, details, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      input.type,
      input.date,
      input.duration_s,
      input.notes,
      JSON.stringify(input.details ?? null),
      now,
      now
    );
  return getWorkout(userId, Number(info.lastInsertRowid))!;
}

/** Returns the updated row, or undefined if no workout matched (wrong id/owner). */
export function updateWorkout(
  userId: number,
  id: number,
  input: WorkoutInput
): Workout | undefined {
  const info = db
    .prepare(
      `UPDATE workouts SET type = ?, date = ?, duration_s = ?, notes = ?, details = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    )
    .run(
      input.type,
      input.date,
      input.duration_s,
      input.notes,
      JSON.stringify(input.details ?? null),
      new Date().toISOString(),
      id,
      userId
    );
  if (info.changes === 0) return undefined;
  return getWorkout(userId, id);
}

/** Returns true if a workout was deleted. */
export function deleteWorkout(userId: number, id: number): boolean {
  const info = db
    .prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?')
    .run(id, userId);
  return info.changes > 0;
}
