import { db } from './index';

export interface ExercisePR {
  name: string;
  weight: number;
  reps: number;
  est_1rm: number; // Epley estimate at the best set
}

export interface StatsData {
  total_workouts: number;
  sets_this_week: number;
  weekly: Array<{ week_start: string; count: number }>; // 6 weeks, oldest→newest
  prs: ExercisePR[]; // heaviest set per exercise, weight desc
}

// Dates are stored as plain YYYY-MM-DD; bucket them in UTC to avoid TZ drift.
function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
/** Monday-anchored start of the ISO week containing `iso`. */
function weekStart(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  const back = (d.getUTCDay() + 6) % 7; // 0 = Monday
  return addDays(iso, -back);
}

interface SetRow {
  reps: number;
  weight_kg: number;
}

function est1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

export function buildStats(userId: number): StatsData {
  const today = isoToday();
  const thisWeek = weekStart(today);

  const total = db
    .prepare('SELECT COUNT(*) AS n FROM workouts WHERE user_id = ?')
    .get(userId) as { n: number };

  // Sets logged this week — counted in SQL via the JSON1 extension.
  const setsRow = db
    .prepare(
      `SELECT COALESCE(SUM(json_array_length(e.sets)), 0) AS n
       FROM exercises e JOIN workouts w ON w.id = e.workout_id
       WHERE e.user_id = ? AND w.date >= ?`
    )
    .get(userId, thisWeek) as { n: number };

  // Six week buckets ending with the current week.
  const anchors: string[] = [];
  for (let i = 5; i >= 0; i--) anchors.push(addDays(thisWeek, -i * 7));
  const counts = new Map(anchors.map((a) => [a, 0]));
  const since = anchors[0];
  const dates = db
    .prepare('SELECT date FROM workouts WHERE user_id = ? AND date >= ?')
    .all(userId, since) as { date: string }[];
  for (const { date } of dates) {
    const ws = weekStart(date);
    if (counts.has(ws)) counts.set(ws, counts.get(ws)! + 1);
  }
  const weekly = anchors.map((a) => ({ week_start: a, count: counts.get(a) ?? 0 }));

  // Personal records: heaviest set per exercise (all exercises are strength).
  const rows = db
    .prepare('SELECT name, sets FROM exercises WHERE user_id = ?')
    .all(userId) as { name: string; sets: string | null }[];
  const best = new Map<string, ExercisePR>();
  for (const row of rows) {
    if (!row.sets) continue;
    let sets: SetRow[];
    try {
      sets = JSON.parse(row.sets) as SetRow[];
    } catch {
      continue;
    }
    for (const s of sets) {
      if (!(s.weight_kg > 0)) continue;
      const prev = best.get(row.name);
      if (!prev || s.weight_kg > prev.weight) {
        best.set(row.name, {
          name: row.name,
          weight: s.weight_kg,
          reps: s.reps,
          est_1rm: Math.round(est1RM(s.weight_kg, s.reps) * 10) / 10,
        });
      }
    }
  }
  const prs = [...best.values()].sort((a, b) => b.weight - a.weight);

  return {
    total_workouts: total.n,
    sets_this_week: setsRow.n,
    weekly,
    prs,
  };
}
