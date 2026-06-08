import type { Knex } from 'knex';

// Evolve workouts into a polymorphic model: a shared core (date, duration,
// notes) plus a `type` discriminator and a JSON `details` payload for
// type-specific data. New activity types (cycle, yoga, ...) need no new table.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('workouts', (table) => {
    // Existing rows predate types and were implicitly strength sessions.
    table.text('type').notNullable().defaultTo('strength');
    table.integer('duration_s'); // shared: length of the activity, nullable
    table.text('details'); // type-specific payload, JSON-encoded
    table.index(['user_id', 'type']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('workouts', (table) => {
    table.dropIndex(['user_id', 'type']);
    table.dropColumn('type');
    table.dropColumn('duration_s');
    table.dropColumn('details');
  });
}
