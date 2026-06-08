import { db } from './index';

export interface WorkoutRow {
  id: number;
  user_id: number;
  date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutInput {
  date: string;
  notes: string | null;
}

// Every query is scoped by user_id so a user can only ever touch their own
// workouts (prevents IDOR via guessable ids).

export function listWorkouts(userId: number): WorkoutRow[] {
  return db
    .prepare(
      'SELECT * FROM workouts WHERE user_id = ? ORDER BY date DESC, id DESC'
    )
    .all(userId) as WorkoutRow[];
}

export function getWorkout(userId: number, id: number): WorkoutRow | undefined {
  return db
    .prepare('SELECT * FROM workouts WHERE id = ? AND user_id = ?')
    .get(id, userId) as WorkoutRow | undefined;
}

export function createWorkout(userId: number, input: WorkoutInput): WorkoutRow {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO workouts (user_id, date, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(userId, input.date, input.notes, now, now);
  return getWorkout(userId, Number(info.lastInsertRowid))!;
}

/** Returns the updated row, or undefined if no workout matched (wrong id/owner). */
export function updateWorkout(
  userId: number,
  id: number,
  input: WorkoutInput
): WorkoutRow | undefined {
  const info = db
    .prepare(
      `UPDATE workouts SET date = ?, notes = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    )
    .run(input.date, input.notes, new Date().toISOString(), id, userId);
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
