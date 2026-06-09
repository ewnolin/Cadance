import type { Knex } from 'knex';

// Public-facing author profile, kept separate from `users` so sharing a display
// name never risks exposing sensitive auth data (password hash, email). One row
// per user (user_id is both PK and FK). See IDEABOARD "Separate public profile
// from sensitive auth data".
//
// Also adds `is_public` to workout_templates so a template can be published into
// the shared library.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('profiles', (table) => {
    table
      .integer('user_id')
      .primary()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.text('display_name').notNullable();
    table.text('bio');
    table.text('created_at').notNullable();
    table.text('updated_at').notNullable();
  });

  // Backfill a default profile for existing users (neutral handle, not derived
  // from their email, so nothing identifying is published by default).
  const now = new Date().toISOString();
  const users = await knex('users').select('id');
  if (users.length > 0) {
    await knex('profiles').insert(
      users.map((u) => ({
        user_id: u.id,
        display_name: `Lifter ${u.id}`,
        bio: null,
        created_at: now,
        updated_at: now,
      }))
    );
  }

  await knex.schema.alterTable('workout_templates', (table) => {
    table.boolean('is_public').notNullable().defaultTo(false);
    table.index(['is_public']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('workout_templates', (table) => {
    table.dropIndex(['is_public']);
    table.dropColumn('is_public');
  });
  await knex.schema.dropTable('profiles');
}
