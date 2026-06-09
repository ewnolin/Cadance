import type { Knex } from 'knex';

// Link a logged exercise to its shared-catalog entry, so muscle-group analytics
// (recommendations, weak areas) can use the exact entry instead of fuzzy
// name-matching. Nullable — free-text exercises stay unlinked. ON DELETE SET
// NULL so removing a catalog entry doesn't delete training history.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('exercises', (table) => {
    table
      .integer('catalog_id')
      .nullable()
      .references('id')
      .inTable('exercise_catalog')
      .onDelete('SET NULL');
    table.index(['catalog_id']);
  });

  // Backfill: link existing logged exercises to a public catalog entry whose
  // name matches (case-insensitive), so historical volume gets muscle data too.
  await knex.raw(`
    UPDATE exercises
    SET catalog_id = (
      SELECT c.id FROM exercise_catalog c
      WHERE c.name = exercises.name COLLATE NOCASE AND c.is_public = 1
      LIMIT 1
    )
    WHERE catalog_id IS NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('exercises', (table) => {
    table.dropIndex(['catalog_id']);
    table.dropColumn('catalog_id');
  });
}
