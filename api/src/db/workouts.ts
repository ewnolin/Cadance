import { db } from './index';
import {
  type Exercise,
  type ExerciseInput,
  listExercisesForWorkout,
  deleteExercisesForWorkout,
  insertExercises,
} from './exercises';

export type WorkoutType = 'strength' | 'run' | 'cycle' | 'yoga';

export type WorkoutFeel = 'easy' | 'moderate' | 'hard' | 'max';

interface WorkoutDbRow {
  id: number;
  user_id: number;
  type: WorkoutType;
  date: string;
  duration_s: number | null;
  notes: string | null;
  feel: WorkoutFeel | null;
  details: string | null;
  created_at: string;
  updated_at: string;
}

// Returned shape: strength workouts carry `exercises` (from rows); other types
// carry their `details` JSON.
export interface Workout {
  id: number;
  user_id: number;
  type: WorkoutType;
  date: string;
  duration_s: number | null;
  notes: string | null;
  feel: WorkoutFeel | null;
  details?: unknown;
  exercises?: Exercise[];
  created_at: string;
  updated_at: string;
}

export interface WorkoutInput {
  type: WorkoutType;
  date: string;
  duration_s: number | null;
  notes: string | null;
  feel: WorkoutFeel | null;
  details: unknown; // null for strength (exercises are stored as rows)
  exercises?: ExerciseInput[]; // present for strength
}

function mapRow(row: WorkoutDbRow): Workout {
  const base = {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    date: row.date,
    duration_s: row.duration_s,
    notes: row.notes,
    feel: row.feel,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if (row.type === 'strength') {
    return { ...base, exercises: listExercisesForWorkout(row.id) };
  }
  return { ...base, details: row.details ? JSON.parse(row.details) : null };
}

function detailsToJson(details: unknown): string | null {
  return details == null ? null : JSON.stringify(details);
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
  const create = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO workouts (user_id, type, date, duration_s, notes, feel, details, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        userId,
        input.type,
        input.date,
        input.duration_s,
        input.notes,
        input.feel,
        detailsToJson(input.details),
        now,
        now
      );
    const id = Number(info.lastInsertRowid);
    if (input.exercises) insertExercises(id, userId, input.exercises);
    return id;
  });
  return getWorkout(userId, create())!;
}

/** Returns the updated row, or undefined if no workout matched (wrong id/owner). */
export function updateWorkout(
  userId: number,
  id: number,
  input: WorkoutInput
): Workout | undefined {
  const update = db.transaction(() => {
    const info = db
      .prepare(
        `UPDATE workouts SET type = ?, date = ?, duration_s = ?, notes = ?, feel = ?, details = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .run(
        input.type,
        input.date,
        input.duration_s,
        input.notes,
        input.feel,
        detailsToJson(input.details),
        new Date().toISOString(),
        id,
        userId
      );
    if (info.changes === 0) return false;
    // Replace exercises: clears them when switching away from strength.
    deleteExercisesForWorkout(id);
    if (input.exercises) insertExercises(id, userId, input.exercises);
    return true;
  });
  if (!update()) return undefined;
  return getWorkout(userId, id);
}

/** Returns true if a workout was deleted (its exercises cascade). */
export function deleteWorkout(userId: number, id: number): boolean {
  const info = db
    .prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?')
    .run(id, userId);
  return info.changes > 0;
}
