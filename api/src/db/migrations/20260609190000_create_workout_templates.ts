import type { Knex } from 'knex';

// Reusable preset workouts a user builds and saves ("Pass A", "Push day", …),
// then starts a live session from. Each template owns an ordered list of
// template_exercises — prescriptions (target sets/reps), not logged data.
//
// Templates are personal for now; sharing them into a public library (with
// is_public + author attribution) is a later migration.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('workout_templates', (table) => {
    table.increments('id').primary();
    table
      .integer('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.text('name').notNullable();
    table.text('notes');
    table.text('created_at').notNullable();
    table.text('updated_at').notNullable();
    table.index(['user_id']);
  });

  await knex.schema.createTable('template_exercises', (table) => {
    table.increments('id').primary();
    table
      .integer('template_id')
      .notNullable()
      .references('id')
      .inTable('workout_templates')
      .onDelete('CASCADE');
    table
      .integer('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE'); // denormalized for user-scoped queries
    // Optional link to the shared catalog (for muscle-group data). The
    // display name is stored denormalized so it survives the catalog entry
    // being deleted (FK then nulls out).
    table
      .integer('catalog_id')
      .nullable()
      .references('id')
      .inTable('exercise_catalog')
      .onDelete('SET NULL');
    table.text('name').notNullable();
    table.integer('position').notNullable().defaultTo(0);
    table.integer('target_sets'); // prescribed set count
    table.text('target_reps'); // free-form rep target ("5", "8-12", "AMRAP")
    table.text('notes'); // e.g. "@85%, long rest"
    table.text('created_at').notNullable();
    table.text('updated_at').notNullable();
    table.index(['template_id']);
    table.index(['user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('template_exercises');
  await knex.schema.dropTable('workout_templates');
}
