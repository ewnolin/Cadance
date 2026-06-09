import type { Knex } from 'knex';

// Subjective post-workout rating (easy/moderate/hard/max) — nullable, applies to
// every workout type. Stored as text; the enum is enforced at the validation
// layer (see WORKOUT_FEELS in lib/validation.ts).
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('workouts', (table) => {
    table.text('feel').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('workouts', (table) => {
    table.dropColumn('feel');
  });
}
