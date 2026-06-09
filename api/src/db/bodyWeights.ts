import { db } from './index';

export interface BodyWeightRow {
  id: number;
  user_id: number;
  date: string;
  weight_kg: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface BodyWeightInput {
  date: string;
  weight_kg: number;
  note: string | null;
}

// Every query is scoped by user_id so a user only ever touches their own data.

export function listBodyWeights(
  userId: number,
  from?: string,
  to?: string
): BodyWeightRow[] {
  // Oldest → newest so the client can plot a trend directly.
  if (from && to) {
    return db
      .prepare(
        'SELECT * FROM body_weights WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date ASC'
      )
      .all(userId, from, to) as BodyWeightRow[];
  }
  return db
    .prepare('SELECT * FROM body_weights WHERE user_id = ? ORDER BY date ASC')
    .all(userId) as BodyWeightRow[];
}

function getByDate(userId: number, date: string): BodyWeightRow | undefined {
  return db
    .prepare('SELECT * FROM body_weights WHERE user_id = ? AND date = ?')
    .get(userId, date) as BodyWeightRow | undefined;
}

/** Insert a weigh-in, or replace the existing one for that date (one per day). */
export function upsertBodyWeight(
  userId: number,
  input: BodyWeightInput
): BodyWeightRow {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO body_weights (user_id, date, weight_kg, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, date)
     DO UPDATE SET weight_kg = excluded.weight_kg, note = excluded.note, updated_at = excluded.updated_at`
  ).run(userId, input.date, input.weight_kg, input.note, now, now);
  return getByDate(userId, input.date)!;
}

/** Returns true if a weigh-in was deleted. */
export function deleteBodyWeight(userId: number, id: number): boolean {
  const info = db
    .prepare('DELETE FROM body_weights WHERE id = ? AND user_id = ?')
    .run(id, userId);
  return info.changes > 0;
}
