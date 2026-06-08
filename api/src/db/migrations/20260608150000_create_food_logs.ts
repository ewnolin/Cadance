import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('food_logs', (table) => {
    table.increments('id').primary();
    table
      .integer('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE'); // erasing a user removes their food logs (GDPR)
    table.text('date').notNullable(); // ISO calendar date, YYYY-MM-DD
    table.text('meal').notNullable(); // breakfast | lunch | dinner | snack
    table.text('name').notNullable();
    table.integer('calories').notNullable();
    table.float('protein').notNullable().defaultTo(0); // grams
    table.float('carbs').notNullable().defaultTo(0);
    table.float('fat').notNullable().defaultTo(0);
    table.text('created_at').notNullable();
    table.text('updated_at').notNullable();
    table.index(['user_id', 'date']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('food_logs');
}
