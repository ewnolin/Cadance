import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('exercises', (table) => {
    table.increments('id').primary();
    table
      .integer('workout_id')
      .notNullable()
      .references('id')
      .inTable('workouts')
      .onDelete('CASCADE');
    table
      .integer('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE'); // denormalized for user-scoped history queries
    table.text('name').notNullable();
    table.integer('position').notNullable().defaultTo(0);
    table.text('sets'); // JSON array of { reps, weight_kg }
    table.text('created_at').notNullable();
    table.text('updated_at').notNullable();
    table.index(['workout_id']);
    table.index(['user_id', 'name']);
  });

  // Backfill: move existing strength workouts' details.exercises into rows,
  // then clear those details (exercises now live in the exercises table).
  const now = new Date().toISOString();
  const strengthWorkouts = await knex('workouts')
    .where('type', 'strength')
    .select('id', 'user_id', 'details');

  for (const w of strengthWorkouts) {
    const details = w.details ? JSON.parse(w.details) : {};
    const exercises: Array<{ name?: string; sets?: unknown }> =
      details.exercises ?? [];

    let position = 0;
    for (const ex of exercises) {
      await knex('exercises').insert({
        workout_id: w.id,
        user_id: w.user_id,
        name: ex.name ?? 'Exercise',
        position: position++,
        sets: JSON.stringify(ex.sets ?? []),
        created_at: now,
        updated_at: now,
      });
    }
    await knex('workouts').where('id', w.id).update({ details: null });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('exercises');
}
