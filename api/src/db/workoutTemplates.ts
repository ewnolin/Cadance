import { db } from './index';

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
  exercises: TemplateExercise[];
  created_at: string;
  updated_at: string;
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
  return { ...row, exercises: listExercises(row.id) };
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
