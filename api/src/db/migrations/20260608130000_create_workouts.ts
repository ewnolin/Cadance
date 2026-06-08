import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('workouts', (table) => {
    table.increments('id').primary();
    table
      .integer('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE'); // erasing a user removes their workouts (GDPR)
    table.text('date').notNullable(); // ISO calendar date, YYYY-MM-DD
    table.text('notes');
    table.text('created_at').notNullable();
    table.text('updated_at').notNullable();
    table.index(['user_id', 'date']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('workouts');
}
