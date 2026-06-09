import type { Knex } from 'knex';

// Bodyweight log — one weigh-in per calendar date (a second log for the same
// date replaces the first, via the unique index + upsert). Kept separate from
// food_logs so the weight trend is independent of nutrition logging.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('body_weights', (table) => {
    table.increments('id').primary();
    table
      .integer('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.text('date').notNullable(); // YYYY-MM-DD
    table.float('weight_kg').notNullable();
    table.text('note');
    table.text('created_at').notNullable();
    table.text('updated_at').notNullable();
    table.unique(['user_id', 'date']); // one weigh-in per day
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('body_weights');
}
