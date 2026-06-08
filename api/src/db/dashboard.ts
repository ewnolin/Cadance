import { db } from './index';
import { WORKOUT_TYPES } from '../lib/validation';
import type { WorkoutType } from './workouts';

export interface DashboardData {
  range: { from: string; to: string; days: number };
  workouts: {
    total: number;
    total_duration_s: number;
    by_type: Record<WorkoutType, number>;
  };
  nutrition: {
    days_logged: number;
    total_calories: number;
    totals: { protein: number; carbs: number; fat: number };
    avg_calories_per_logged_day: number;
  };
  streaks: { workouts: number; nutrition: number };
  daily: Array<{
    date: string;
    workouts: number;
    workout_duration_s: number;
    calories: number;
  }>;
}

// ---- date helpers (dates are stored as plain YYYY-MM-DD; work in UTC) ----

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function enumerateDates(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/**
 * Consecutive days ending today with at least one entry. Today is given a grace
 * period: if nothing is logged yet today, counting starts from yesterday so the
 * streak doesn't break until the day actually ends.
 */
function currentStreak(dateSet: Set<string>): number {
  let cursor = isoToday();
  if (!dateSet.has(cursor)) cursor = addDays(cursor, -1);
  let streak = 0;
  while (dateSet.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function distinctDatesSince(
  table: 'workouts' | 'food_logs',
  userId: number,
  since: string
): Set<string> {
  const rows = db
    .prepare(`SELECT DISTINCT date FROM ${table} WHERE user_id = ? AND date >= ?`)
    .all(userId, since) as { date: string }[];
  return new Set(rows.map((r) => r.date));
}

export function buildDashboard(userId: number, days: number): DashboardData {
  const to = isoToday();
  const from = addDays(to, -(days - 1));

  // Workout totals by type, in range.
  const workoutRows = db
    .prepare(
      `SELECT type, COUNT(*) AS count, COALESCE(SUM(duration_s), 0) AS dur
       FROM workouts WHERE user_id = ? AND date BETWEEN ? AND ? GROUP BY type`
    )
    .all(userId, from, to) as { type: WorkoutType; count: number; dur: number }[];

  const byType = Object.fromEntries(
    WORKOUT_TYPES.map((t) => [t, 0])
  ) as Record<WorkoutType, number>;
  let workoutTotal = 0;
  let workoutDuration = 0;
  for (const r of workoutRows) {
    byType[r.type] = r.count;
    workoutTotal += r.count;
    workoutDuration += r.dur;
  }

  // Nutrition totals, in range.
  const n = db
    .prepare(
      `SELECT COUNT(DISTINCT date) AS days_logged,
              COALESCE(SUM(calories), 0) AS calories,
              COALESCE(SUM(protein), 0)  AS protein,
              COALESCE(SUM(carbs), 0)    AS carbs,
              COALESCE(SUM(fat), 0)      AS fat
       FROM food_logs WHERE user_id = ? AND date BETWEEN ? AND ?`
    )
    .get(userId, from, to) as {
    days_logged: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };

  // Per-day breakdown for charts.
  const workoutsByDate = new Map(
    (
      db
        .prepare(
          `SELECT date, COUNT(*) AS count, COALESCE(SUM(duration_s), 0) AS dur
           FROM workouts WHERE user_id = ? AND date BETWEEN ? AND ? GROUP BY date`
        )
        .all(userId, from, to) as { date: string; count: number; dur: number }[]
    ).map((r) => [r.date, r])
  );
  const caloriesByDate = new Map(
    (
      db
        .prepare(
          `SELECT date, COALESCE(SUM(calories), 0) AS cal
           FROM food_logs WHERE user_id = ? AND date BETWEEN ? AND ? GROUP BY date`
        )
        .all(userId, from, to) as { date: string; cal: number }[]
    ).map((r) => [r.date, r.cal])
  );
  const daily = enumerateDates(from, to).map((date) => ({
    date,
    workouts: workoutsByDate.get(date)?.count ?? 0,
    workout_duration_s: workoutsByDate.get(date)?.dur ?? 0,
    calories: caloriesByDate.get(date) ?? 0,
  }));

  // Streaks look back up to ~1 year.
  const lookback = addDays(to, -366);

  return {
    range: { from, to, days },
    workouts: {
      total: workoutTotal,
      total_duration_s: workoutDuration,
      by_type: byType,
    },
    nutrition: {
      days_logged: n.days_logged,
      total_calories: n.calories,
      totals: { protein: n.protein, carbs: n.carbs, fat: n.fat },
      avg_calories_per_logged_day: n.days_logged
        ? Math.round(n.calories / n.days_logged)
        : 0,
    },
    streaks: {
      workouts: currentStreak(distinctDatesSince('workouts', userId, lookback)),
      nutrition: currentStreak(distinctDatesSince('food_logs', userId, lookback)),
    },
    daily,
  };
}
