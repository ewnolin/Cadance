import type { Knex } from 'knex';

// A shared library of exercises tagged with the muscle groups they train.
// Global (seeded) entries have created_by = NULL and is_public = 1; users can
// add their own custom entries (created_by set). Muscle lists are stored as JSON
// text arrays of the fixed MUSCLE_GROUPS taxonomy (see lib/validation.ts).
//
// Muscle strings are inlined here rather than imported so the migration stays a
// self-contained snapshot — it must keep applying even if the app's taxonomy
// constant later changes.
type Seed = {
  name: string;
  category: 'compound' | 'isolation';
  equipment:
    | 'barbell'
    | 'dumbbell'
    | 'machine'
    | 'cable'
    | 'bodyweight'
    | 'kettlebell'
    | 'other';
  primary: string[];
  secondary: string[];
};

const SEED: Seed[] = [
  // Chest
  { name: 'Barbell Bench Press', category: 'compound', equipment: 'barbell', primary: ['chest'], secondary: ['triceps', 'shoulders'] },
  { name: 'Incline Dumbbell Press', category: 'compound', equipment: 'dumbbell', primary: ['chest'], secondary: ['shoulders', 'triceps'] },
  { name: 'Dumbbell Bench Press', category: 'compound', equipment: 'dumbbell', primary: ['chest'], secondary: ['triceps', 'shoulders'] },
  { name: 'Push-Up', category: 'compound', equipment: 'bodyweight', primary: ['chest'], secondary: ['triceps', 'shoulders', 'core'] },
  { name: 'Cable Fly', category: 'isolation', equipment: 'cable', primary: ['chest'], secondary: [] },
  { name: 'Dips', category: 'compound', equipment: 'bodyweight', primary: ['chest'], secondary: ['triceps', 'shoulders'] },
  { name: 'Machine Chest Press', category: 'compound', equipment: 'machine', primary: ['chest'], secondary: ['triceps', 'shoulders'] },
  // Back / lats / traps
  { name: 'Pull-Up', category: 'compound', equipment: 'bodyweight', primary: ['lats'], secondary: ['biceps', 'back', 'forearms'] },
  { name: 'Chin-Up', category: 'compound', equipment: 'bodyweight', primary: ['lats'], secondary: ['biceps'] },
  { name: 'Lat Pulldown', category: 'compound', equipment: 'cable', primary: ['lats'], secondary: ['biceps'] },
  { name: 'Barbell Row', category: 'compound', equipment: 'barbell', primary: ['back'], secondary: ['lats', 'biceps'] },
  { name: 'Bent-Over Dumbbell Row', category: 'compound', equipment: 'dumbbell', primary: ['back'], secondary: ['lats', 'biceps'] },
  { name: 'Seated Cable Row', category: 'compound', equipment: 'cable', primary: ['back'], secondary: ['lats', 'biceps'] },
  { name: 'One-Arm Dumbbell Row', category: 'compound', equipment: 'dumbbell', primary: ['back'], secondary: ['lats', 'biceps'] },
  { name: 'Face Pull', category: 'isolation', equipment: 'cable', primary: ['traps'], secondary: ['shoulders', 'back'] },
  { name: 'Barbell Shrug', category: 'isolation', equipment: 'barbell', primary: ['traps'], secondary: ['forearms'] },
  { name: 'Deadlift', category: 'compound', equipment: 'barbell', primary: ['back'], secondary: ['glutes', 'hamstrings', 'traps', 'forearms'] },
  // Shoulders
  { name: 'Overhead Press', category: 'compound', equipment: 'barbell', primary: ['shoulders'], secondary: ['triceps'] },
  { name: 'Seated Dumbbell Shoulder Press', category: 'compound', equipment: 'dumbbell', primary: ['shoulders'], secondary: ['triceps'] },
  { name: 'Lateral Raise', category: 'isolation', equipment: 'dumbbell', primary: ['shoulders'], secondary: [] },
  { name: 'Rear Delt Fly', category: 'isolation', equipment: 'dumbbell', primary: ['shoulders'], secondary: ['traps'] },
  { name: 'Arnold Press', category: 'compound', equipment: 'dumbbell', primary: ['shoulders'], secondary: ['triceps'] },
  // Biceps
  { name: 'Barbell Curl', category: 'isolation', equipment: 'barbell', primary: ['biceps'], secondary: ['forearms'] },
  { name: 'Dumbbell Curl', category: 'isolation', equipment: 'dumbbell', primary: ['biceps'], secondary: ['forearms'] },
  { name: 'Hammer Curl', category: 'isolation', equipment: 'dumbbell', primary: ['biceps'], secondary: ['forearms'] },
  { name: 'Preacher Curl', category: 'isolation', equipment: 'machine', primary: ['biceps'], secondary: [] },
  // Triceps
  { name: 'Triceps Pushdown', category: 'isolation', equipment: 'cable', primary: ['triceps'], secondary: [] },
  { name: 'Skull Crusher', category: 'isolation', equipment: 'barbell', primary: ['triceps'], secondary: [] },
  { name: 'Overhead Triceps Extension', category: 'isolation', equipment: 'dumbbell', primary: ['triceps'], secondary: [] },
  { name: 'Close-Grip Bench Press', category: 'compound', equipment: 'barbell', primary: ['triceps'], secondary: ['chest', 'shoulders'] },
  // Quads / legs
  { name: 'Back Squat', category: 'compound', equipment: 'barbell', primary: ['quads'], secondary: ['glutes', 'hamstrings', 'core'] },
  { name: 'Front Squat', category: 'compound', equipment: 'barbell', primary: ['quads'], secondary: ['glutes', 'core'] },
  { name: 'Leg Press', category: 'compound', equipment: 'machine', primary: ['quads'], secondary: ['glutes', 'hamstrings'] },
  { name: 'Bulgarian Split Squat', category: 'compound', equipment: 'dumbbell', primary: ['quads'], secondary: ['glutes', 'hamstrings'] },
  { name: 'Walking Lunge', category: 'compound', equipment: 'dumbbell', primary: ['quads'], secondary: ['glutes', 'hamstrings'] },
  { name: 'Leg Extension', category: 'isolation', equipment: 'machine', primary: ['quads'], secondary: [] },
  // Hamstrings / glutes
  { name: 'Romanian Deadlift', category: 'compound', equipment: 'barbell', primary: ['hamstrings'], secondary: ['glutes', 'back'] },
  { name: 'Leg Curl', category: 'isolation', equipment: 'machine', primary: ['hamstrings'], secondary: [] },
  { name: 'Hip Thrust', category: 'compound', equipment: 'barbell', primary: ['glutes'], secondary: ['hamstrings'] },
  // Calves
  { name: 'Standing Calf Raise', category: 'isolation', equipment: 'machine', primary: ['calves'], secondary: [] },
  { name: 'Seated Calf Raise', category: 'isolation', equipment: 'machine', primary: ['calves'], secondary: [] },
  // Core
  { name: 'Plank', category: 'isolation', equipment: 'bodyweight', primary: ['core'], secondary: [] },
  { name: 'Hanging Leg Raise', category: 'isolation', equipment: 'bodyweight', primary: ['core'], secondary: [] },
  { name: 'Cable Crunch', category: 'isolation', equipment: 'cable', primary: ['core'], secondary: [] },
  { name: 'Ab Wheel Rollout', category: 'isolation', equipment: 'bodyweight', primary: ['core'], secondary: [] },
  { name: 'Russian Twist', category: 'isolation', equipment: 'bodyweight', primary: ['core'], secondary: [] },
];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('exercise_catalog', (table) => {
    table.increments('id').primary();
    // NULL for seeded/global entries; the owner for user-created ones.
    table
      .integer('created_by')
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.text('name').notNullable();
    table.text('category').notNullable().defaultTo('compound');
    table.text('equipment').notNullable().defaultTo('other');
    table.text('primary_muscles').notNullable(); // JSON array of muscle strings
    table.text('secondary_muscles').notNullable().defaultTo('[]'); // JSON array
    table.boolean('is_public').notNullable().defaultTo(false);
    table.text('created_at').notNullable();
    table.text('updated_at').notNullable();
    table.index(['created_by']);
    table.index(['is_public']);
  });

  const now = new Date().toISOString();
  await knex('exercise_catalog').insert(
    SEED.map((s) => ({
      created_by: null,
      name: s.name,
      category: s.category,
      equipment: s.equipment,
      primary_muscles: JSON.stringify(s.primary),
      secondary_muscles: JSON.stringify(s.secondary),
      is_public: true,
      created_at: now,
      updated_at: now,
    }))
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('exercise_catalog');
}
