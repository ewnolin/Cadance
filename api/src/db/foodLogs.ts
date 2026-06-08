import { db } from './index';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodLogRow {
  id: number;
  user_id: number;
  date: string;
  meal: MealType;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: string;
  updated_at: string;
}

export interface FoodLogInput {
  date: string;
  meal: MealType;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodSummary {
  date: string;
  count: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// Every query is scoped by user_id so a user can only ever touch their own
// food logs (prevents IDOR via guessable ids).

export function listFoodLogs(userId: number, date?: string): FoodLogRow[] {
  return (
    date
      ? db
          .prepare(
            'SELECT * FROM food_logs WHERE user_id = ? AND date = ? ORDER BY id DESC'
          )
          .all(userId, date)
      : db
          .prepare(
            'SELECT * FROM food_logs WHERE user_id = ? ORDER BY date DESC, id DESC'
          )
          .all(userId)
  ) as FoodLogRow[];
}

export function getFoodLog(userId: number, id: number): FoodLogRow | undefined {
  return db
    .prepare('SELECT * FROM food_logs WHERE id = ? AND user_id = ?')
    .get(id, userId) as FoodLogRow | undefined;
}

export function createFoodLog(userId: number, input: FoodLogInput): FoodLogRow {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO food_logs (user_id, date, meal, name, calories, protein, carbs, fat, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      input.date,
      input.meal,
      input.name,
      input.calories,
      input.protein,
      input.carbs,
      input.fat,
      now,
      now
    );
  return getFoodLog(userId, Number(info.lastInsertRowid))!;
}

/** Returns the updated row, or undefined if no log matched (wrong id/owner). */
export function updateFoodLog(
  userId: number,
  id: number,
  input: FoodLogInput
): FoodLogRow | undefined {
  const info = db
    .prepare(
      `UPDATE food_logs SET date = ?, meal = ?, name = ?, calories = ?, protein = ?, carbs = ?, fat = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    )
    .run(
      input.date,
      input.meal,
      input.name,
      input.calories,
      input.protein,
      input.carbs,
      input.fat,
      new Date().toISOString(),
      id,
      userId
    );
  if (info.changes === 0) return undefined;
  return getFoodLog(userId, id);
}

/** Returns true if a log was deleted. */
export function deleteFoodLog(userId: number, id: number): boolean {
  const info = db
    .prepare('DELETE FROM food_logs WHERE id = ? AND user_id = ?')
    .run(id, userId);
  return info.changes > 0;
}

/** Daily nutrition totals for a single date. */
export function summarizeByDate(userId: number, date: string): FoodSummary {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(calories), 0) AS calories,
              COALESCE(SUM(protein), 0) AS protein,
              COALESCE(SUM(carbs), 0)   AS carbs,
              COALESCE(SUM(fat), 0)     AS fat
       FROM food_logs WHERE user_id = ? AND date = ?`
    )
    .get(userId, date) as Omit<FoodSummary, 'date'>;
  return { date, ...row };
}
