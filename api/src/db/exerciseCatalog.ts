import { db } from './index';

export interface CatalogEntry {
  id: number;
  created_by: number | null;
  name: string;
  category: string;
  equipment: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface CatalogEntryInput {
  name: string;
  category: string;
  equipment: string;
  primary_muscles: string[];
  secondary_muscles: string[];
}

export interface CatalogFilters {
  muscle?: string; // matches primary OR secondary
  q?: string; // case-insensitive name substring
  equipment?: string;
  category?: string;
}

interface CatalogDbRow {
  id: number;
  created_by: number | null;
  name: string;
  category: string;
  equipment: string;
  primary_muscles: string;
  secondary_muscles: string;
  is_public: number; // SQLite stores booleans as 0/1
  created_at: string;
  updated_at: string;
}

function mapRow(row: CatalogDbRow): CatalogEntry {
  return {
    ...row,
    is_public: !!row.is_public,
    primary_muscles: JSON.parse(row.primary_muscles) as string[],
    secondary_muscles: JSON.parse(row.secondary_muscles) as string[],
  };
}

/**
 * Catalog entries visible to a user: the global/public library plus their own
 * custom entries. Optional filters narrow by muscle, name, equipment or
 * category. Muscle matching needs the JSON arrays parsed, so it's applied in JS
 * after the (small) visible set is fetched; the rest is pushed into SQL.
 */
export function listCatalog(
  userId: number,
  filters: CatalogFilters = {}
): CatalogEntry[] {
  const where = ['(is_public = 1 OR created_by = ?)'];
  const params: unknown[] = [userId];

  if (filters.equipment) {
    where.push('equipment = ?');
    params.push(filters.equipment);
  }
  if (filters.category) {
    where.push('category = ?');
    params.push(filters.category);
  }
  if (filters.q) {
    where.push('name LIKE ? ESCAPE ?');
    // Escape LIKE wildcards in user input so "100%" searches literally.
    const escaped = filters.q.replace(/[\\%_]/g, (c) => `\\${c}`);
    params.push(`%${escaped}%`, '\\');
  }

  const rows = db
    .prepare(
      `SELECT * FROM exercise_catalog WHERE ${where.join(
        ' AND '
      )} ORDER BY name COLLATE NOCASE ASC`
    )
    .all(...params) as CatalogDbRow[];

  let entries = rows.map(mapRow);
  if (filters.muscle) {
    const m = filters.muscle;
    entries = entries.filter(
      (e) => e.primary_muscles.includes(m) || e.secondary_muscles.includes(m)
    );
  }
  return entries;
}

/** One entry the user can see (public or their own), or undefined. */
export function getCatalogEntry(
  userId: number,
  id: number
): CatalogEntry | undefined {
  const row = db
    .prepare(
      'SELECT * FROM exercise_catalog WHERE id = ? AND (is_public = 1 OR created_by = ?)'
    )
    .get(id, userId) as CatalogDbRow | undefined;
  return row ? mapRow(row) : undefined;
}

/** Create a custom (private) catalog entry owned by the user. */
export function createCatalogEntry(
  userId: number,
  input: CatalogEntryInput
): CatalogEntry {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO exercise_catalog
         (created_by, name, category, equipment, primary_muscles, secondary_muscles, is_public, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .run(
      userId,
      input.name,
      input.category,
      input.equipment,
      JSON.stringify(input.primary_muscles),
      JSON.stringify(input.secondary_muscles),
      now,
      now
    );
  return getCatalogEntry(userId, Number(info.lastInsertRowid))!;
}
