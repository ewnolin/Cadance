import { db } from './index';
import { MUSCLE_GROUPS, type MuscleGroup } from '../lib/validation';
import {
  catalogByName,
  getCatalogEntriesByIds,
  type CatalogEntry,
} from './exerciseCatalog';
import {
  listPublicTemplates,
  type LibraryTemplate,
} from './workoutTemplates';

// Rough hypertrophy guideline: ~10–20 working sets per muscle per week. We use
// the low end as the "trained enough" bar; muscles under it are flagged weak.
const TARGET_SETS_PER_WEEK = 10;

export interface WeakArea {
  muscle: MuscleGroup;
  sets: number;
  deficit: number; // target - sets
}

export interface SuggestedTemplate {
  template: LibraryTemplate;
  matched_muscles: string[]; // weak muscles this template trains
  score: number;
}

export interface Recommendations {
  range: { from: string; to: string; days: number };
  target_sets_per_muscle: number;
  // Sets where the muscle is the *primary* mover, in the window (the standard
  // way "sets per muscle" is counted). Every muscle is present (0 if untrained).
  muscle_volume: Record<MuscleGroup, number>;
  weak_areas: WeakArea[];
  recently_trained: MuscleGroup[]; // primary muscles of the last strength session
  suggested_templates: SuggestedTemplate[];
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

interface LoggedExerciseRow {
  name: string;
  sets: string | null;
  catalog_id: number | null;
}

/**
 * Resolve a logged exercise to its catalog entry: prefer the explicit
 * `catalog_id` link, falling back to a case-insensitive name match. Returns
 * undefined for unrecognized free-text exercises.
 */
function resolveEntry(
  row: { name: string; catalog_id: number | null },
  byId: Map<number, CatalogEntry>,
  byName: ReturnType<typeof catalogByName>
): CatalogEntry | undefined {
  if (row.catalog_id != null) return byId.get(row.catalog_id);
  return byName.get(row.name.toLowerCase());
}

function setCount(sets: string | null): number {
  if (!sets) return 0;
  try {
    const parsed = JSON.parse(sets);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/** Primary muscles trained by the user's most recent strength session. */
function recentlyTrained(
  userId: number,
  byName: ReturnType<typeof catalogByName>
): MuscleGroup[] {
  const last = db
    .prepare(
      `SELECT id FROM workouts WHERE user_id = ? AND type = 'strength'
       ORDER BY date DESC, id DESC LIMIT 1`
    )
    .get(userId) as { id: number } | undefined;
  if (!last) return [];

  const rows = db
    .prepare('SELECT name, sets, catalog_id FROM exercises WHERE workout_id = ?')
    .all(last.id) as LoggedExerciseRow[];

  const byId = getCatalogEntriesByIds(
    rows.map((r) => r.catalog_id).filter((id): id is number => id != null)
  );
  const muscles = new Set<MuscleGroup>();
  for (const r of rows) {
    const entry = resolveEntry(r, byId, byName);
    if (!entry) continue;
    for (const m of entry.primary_muscles) muscles.add(m as MuscleGroup);
  }
  return [...muscles];
}

export function getRecommendations(
  userId: number,
  days: number
): Recommendations {
  const to = isoToday();
  const from = addDays(to, -(days - 1));
  const target = Math.max(1, Math.round((TARGET_SETS_PER_WEEK * days) / 7));

  const byName = catalogByName(userId);

  // Logged strength exercises in the window, with their set counts.
  const rows = db
    .prepare(
      `SELECT e.name AS name, e.sets AS sets, e.catalog_id AS catalog_id
       FROM exercises e JOIN workouts w ON w.id = e.workout_id
       WHERE e.user_id = ? AND w.date BETWEEN ? AND ?`
    )
    .all(userId, from, to) as LoggedExerciseRow[];

  const byId = getCatalogEntriesByIds(
    rows.map((r) => r.catalog_id).filter((id): id is number => id != null)
  );

  const volume = Object.fromEntries(
    MUSCLE_GROUPS.map((m) => [m, 0])
  ) as Record<MuscleGroup, number>;

  for (const r of rows) {
    const entry = resolveEntry(r, byId, byName);
    if (!entry) continue; // unrecognized free-text exercise — no muscle credit
    const n = setCount(r.sets);
    for (const m of entry.primary_muscles) {
      volume[m as MuscleGroup] += n;
    }
  }

  const weak_areas: WeakArea[] = MUSCLE_GROUPS.map((muscle) => ({
    muscle,
    sets: volume[muscle],
    deficit: target - volume[muscle],
  }))
    .filter((w) => w.deficit > 0)
    .sort((a, b) => b.deficit - a.deficit || a.muscle.localeCompare(b.muscle));

  const weakSet = new Set(weak_areas.map((w) => w.muscle as string));

  // Public library templates that hit the most weak areas, best first.
  const suggested_templates: SuggestedTemplate[] = weakSet.size
    ? listPublicTemplates()
        .map((template) => {
          const matched = template.muscles.filter((m) => weakSet.has(m));
          return { template, matched_muscles: matched, score: matched.length };
        })
        .filter((s) => s.score > 0)
        .sort(
          (a, b) =>
            b.score - a.score ||
            b.template.updated_at.localeCompare(a.template.updated_at)
        )
        .slice(0, 5)
    : [];

  return {
    range: { from, to, days },
    target_sets_per_muscle: target,
    muscle_volume: volume,
    weak_areas,
    recently_trained: recentlyTrained(userId, byName),
    suggested_templates,
  };
}
