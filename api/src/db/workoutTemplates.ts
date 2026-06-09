import { db } from './index';
import { getCatalogEntriesByIds } from './exerciseCatalog';
import { getPublicProfile, type PublicProfile } from './profiles';

export interface TemplateExercise {
  id: number;
  template_id: number;
  user_id: number;
  catalog_id: number | null;
  name: string;
  position: number;
  target_sets: number | null;
  target_reps: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateExerciseInput {
  name: string;
  catalog_id?: number | null;
  target_sets?: number | null;
  target_reps?: string | null;
  notes?: string | null;
}

export interface WorkoutTemplate {
  id: number;
  user_id: number;
  name: string;
  notes: string | null;
  is_public: boolean;
  exercises: TemplateExercise[];
  created_at: string;
  updated_at: string;
}

/** A template as seen in the public library: with author + trained muscles. */
export interface LibraryTemplate extends WorkoutTemplate {
  author: PublicProfile;
  muscles: string[];
}

export interface WorkoutTemplateInput {
  name: string;
  notes: string | null;
  exercises: TemplateExerciseInput[];
}

interface TemplateDbRow {
  id: number;
  user_id: number;
  name: string;
  notes: string | null;
  is_public: number; // SQLite stores booleans as 0/1
  created_at: string;
  updated_at: string;
}

function listExercises(templateId: number): TemplateExercise[] {
  return db
    .prepare(
      'SELECT * FROM template_exercises WHERE template_id = ? ORDER BY position ASC, id ASC'
    )
    .all(templateId) as TemplateExercise[];
}

function mapRow(row: TemplateDbRow): WorkoutTemplate {
  return {
    ...row,
    is_public: !!row.is_public,
    exercises: listExercises(row.id),
  };
}

/** Union of muscle groups (primary + secondary) trained by linked exercises. */
function musclesFor(exercises: TemplateExercise[]): string[] {
  const ids = exercises
    .map((e) => e.catalog_id)
    .filter((id): id is number => id != null);
  const catalog = getCatalogEntriesByIds(ids);
  const muscles = new Set<string>();
  for (const ex of exercises) {
    if (ex.catalog_id == null) continue;
    const entry = catalog.get(ex.catalog_id);
    if (!entry) continue;
    for (const m of entry.primary_muscles) muscles.add(m);
    for (const m of entry.secondary_muscles) muscles.add(m);
  }
  return [...muscles];
}

function toLibraryTemplate(t: WorkoutTemplate): LibraryTemplate {
  return {
    ...t,
    author: getPublicProfile(t.user_id),
    muscles: musclesFor(t.exercises),
  };
}

// Every query is scoped by user_id so a user only ever touches their own
// templates (prevents IDOR via guessable ids).

export function listTemplates(userId: number): WorkoutTemplate[] {
  const rows = db
    .prepare(
      'SELECT * FROM workout_templates WHERE user_id = ? ORDER BY name COLLATE NOCASE ASC'
    )
    .all(userId) as TemplateDbRow[];
  return rows.map(mapRow);
}

export function getTemplate(
  userId: number,
  id: number
): WorkoutTemplate | undefined {
  const row = db
    .prepare('SELECT * FROM workout_templates WHERE id = ? AND user_id = ?')
    .get(id, userId) as TemplateDbRow | undefined;
  return row ? mapRow(row) : undefined;
}

function insertExercises(
  templateId: number,
  userId: number,
  exercises: TemplateExerciseInput[]
): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO template_exercises
       (template_id, user_id, catalog_id, name, position, target_sets, target_reps, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  exercises.forEach((ex, i) => {
    stmt.run(
      templateId,
      userId,
      ex.catalog_id ?? null,
      ex.name,
      i,
      ex.target_sets ?? null,
      ex.target_reps ?? null,
      ex.notes ?? null,
      now,
      now
    );
  });
}

export function createTemplate(
  userId: number,
  input: WorkoutTemplateInput
): WorkoutTemplate {
  const now = new Date().toISOString();
  const create = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO workout_templates (user_id, name, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(userId, input.name, input.notes, now, now);
    const id = Number(info.lastInsertRowid);
    insertExercises(id, userId, input.exercises);
    return id;
  });
  return getTemplate(userId, create())!;
}

/** Returns the updated template, or undefined if none matched (wrong id/owner). */
export function updateTemplate(
  userId: number,
  id: number,
  input: WorkoutTemplateInput
): WorkoutTemplate | undefined {
  const update = db.transaction(() => {
    const info = db
      .prepare(
        `UPDATE workout_templates SET name = ?, notes = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .run(input.name, input.notes, new Date().toISOString(), id, userId);
    if (info.changes === 0) return false;
    // Replace the exercise list wholesale (children cascade-delete with parent,
    // but here the parent stays — clear and re-insert).
    db.prepare('DELETE FROM template_exercises WHERE template_id = ?').run(id);
    insertExercises(id, userId, input.exercises);
    return true;
  });
  if (!update()) return undefined;
  return getTemplate(userId, id);
}

/** Returns true if a template was deleted (its exercises cascade). */
export function deleteTemplate(userId: number, id: number): boolean {
  const info = db
    .prepare('DELETE FROM workout_templates WHERE id = ? AND user_id = ?')
    .run(id, userId);
  return info.changes > 0;
}

/** Publish/unpublish a template the user owns. Undefined if no match. */
export function setTemplateVisibility(
  userId: number,
  id: number,
  isPublic: boolean
): WorkoutTemplate | undefined {
  const info = db
    .prepare(
      'UPDATE workout_templates SET is_public = ?, updated_at = ? WHERE id = ? AND user_id = ?'
    )
    .run(isPublic ? 1 : 0, new Date().toISOString(), id, userId);
  if (info.changes === 0) return undefined;
  return getTemplate(userId, id);
}

export interface LibraryFilters {
  muscle?: string; // template trains this muscle (via a linked catalog exercise)
  q?: string; // case-insensitive name substring
}

/** The public library: published templates from all users, newest first. */
export function listPublicTemplates(filters: LibraryFilters = {}): LibraryTemplate[] {
  const where = ['is_public = 1'];
  const params: unknown[] = [];
  if (filters.q) {
    where.push('name LIKE ? ESCAPE ?');
    const escaped = filters.q.replace(/[\\%_]/g, (c) => `\\${c}`);
    params.push(`%${escaped}%`, '\\');
  }
  const rows = db
    .prepare(
      `SELECT * FROM workout_templates WHERE ${where.join(
        ' AND '
      )} ORDER BY updated_at DESC, id DESC`
    )
    .all(...params) as TemplateDbRow[];

  let entries = rows.map((r) => toLibraryTemplate(mapRow(r)));
  if (filters.muscle) {
    entries = entries.filter((e) => e.muscles.includes(filters.muscle!));
  }
  return entries;
}

/** One published template by id (any owner), with author + muscles. */
export function getPublicTemplate(id: number): LibraryTemplate | undefined {
  const row = db
    .prepare('SELECT * FROM workout_templates WHERE id = ? AND is_public = 1')
    .get(id) as TemplateDbRow | undefined;
  return row ? toLibraryTemplate(mapRow(row)) : undefined;
}

/**
 * Copy a published template into the user's own (private) templates, carrying
 * its exercises. Returns undefined if the source isn't a public template.
 */
export function copyPublicTemplate(
  userId: number,
  sourceId: number
): WorkoutTemplate | undefined {
  const source = getPublicTemplate(sourceId);
  if (!source) return undefined;
  return createTemplate(userId, {
    name: source.name,
    notes: source.notes,
    exercises: source.exercises.map((e) => ({
      name: e.name,
      catalog_id: e.catalog_id,
      target_sets: e.target_sets,
      target_reps: e.target_reps,
      notes: e.notes,
    })),
  });
}
