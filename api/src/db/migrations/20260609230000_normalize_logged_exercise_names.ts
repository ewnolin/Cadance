import type { Knex } from 'knex';

// Alias merging backfill: normalize already-logged exercises that are linked to
// a catalog entry so their stored `name` matches the catalog's canonical name.
// Going forward this is enforced at write time (see insertExercises); this
// brings existing rows in line so history/PRs group consistently.
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    UPDATE exercises
    SET name = (SELECT c.name FROM exercise_catalog c WHERE c.id = exercises.catalog_id)
    WHERE catalog_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM exercise_catalog c WHERE c.id = exercises.catalog_id)
  `);
}

export async function down(): Promise<void> {
  // One-way data normalization — the original per-row spellings aren't retained,
  // so there's nothing to restore.
}
