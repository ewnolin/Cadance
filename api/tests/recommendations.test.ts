import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { app, resetDb, registerAgent } from './helpers';

afterEach(resetDb);

type Agent = ReturnType<typeof request.agent>;

const today = new Date().toISOString().slice(0, 10);

async function catalogId(agent: Agent, q: string): Promise<number> {
  const res = await agent
    .get(`/exercises/catalog?q=${encodeURIComponent(q)}`)
    .expect(200);
  return res.body.data[0].id as number;
}

/** Log a strength workout today with one exercise of `setCount` sets. */
function logExercise(agent: Agent, name: string, setCount: number) {
  const sets = Array.from({ length: setCount }, () => ({ reps: 8, weight_kg: 50 }));
  return agent
    .post('/workouts')
    .send({ type: 'strength', date: today, exercises: [{ name, sets }] })
    .expect(201);
}

describe('recommendations', () => {
  it('requires authentication and validates the window', async () => {
    await request(app).get('/recommendations').expect(401);
    const agent = await registerAgent('r0@example.com');
    await agent.get('/recommendations?days=0').expect(400);
    await agent.get('/recommendations?days=40').expect(400);
  });

  it('flags every muscle weak when nothing has been logged', async () => {
    const agent = await registerAgent('r1@example.com');
    const res = await agent.get('/recommendations').expect(200);

    expect(res.body.data.target_sets_per_muscle).toBe(10); // 10 * 7 / 7
    expect(res.body.data.muscle_volume.chest).toBe(0);
    // All 13 muscles are under target.
    expect(res.body.data.weak_areas).toHaveLength(13);
    expect(res.body.data.recently_trained).toEqual([]);
    expect(res.body.data.suggested_templates).toEqual([]); // no public library yet
  });

  it('counts primary-mover volume and clears a muscle once it hits target', async () => {
    const agent = await registerAgent('r2@example.com');
    await logExercise(agent, 'Barbell Bench Press', 10); // chest primary ×10 = target

    const res = await agent.get('/recommendations').expect(200);
    expect(res.body.data.muscle_volume.chest).toBe(10);

    const weakMuscles = res.body.data.weak_areas.map((w: { muscle: string }) => w.muscle);
    expect(weakMuscles).not.toContain('chest'); // met the target
    expect(weakMuscles).toContain('quads'); // untrained, still weak
    expect(res.body.data.recently_trained).toContain('chest');
  });

  it('only credits exercises it can map to the catalog', async () => {
    const agent = await registerAgent('r3@example.com');
    await logExercise(agent, 'Made-Up Machine Thing', 5); // not in catalog

    const res = await agent.get('/recommendations').expect(200);
    // No muscle got credit; total volume is zero.
    const total = Object.values(res.body.data.muscle_volume as Record<string, number>).reduce(
      (a, b) => a + b,
      0
    );
    expect(total).toBe(0);
  });

  it('credits volume via catalog_id even when the logged name is custom', async () => {
    const agent = await registerAgent('rcat@example.com');
    const benchId = await catalogId(agent, 'Barbell Bench Press'); // chest primary

    // Logged under a name that matches no catalog entry, but linked by id.
    const sets = Array.from({ length: 4 }, () => ({ reps: 8, weight_kg: 60 }));
    await agent
      .post('/workouts')
      .send({
        type: 'strength',
        date: today,
        exercises: [{ name: 'My Pet Bench Variation', catalog_id: benchId, sets }],
      })
      .expect(201);

    const res = await agent.get('/recommendations').expect(200);
    expect(res.body.data.muscle_volume.chest).toBe(4); // credited via the link
    expect(res.body.data.recently_trained).toContain('chest');
  });

  it('suggests public templates that train your weak areas, best first', async () => {
    const author = await registerAgent('rauthor@example.com');
    const rowId = await catalogId(author, 'Barbell Row'); // back
    const squatId = await catalogId(author, 'Back Squat'); // quads

    // A back+legs template (2 weak muscles) and a back-only template (1).
    const big = await author
      .post('/workout-templates')
      .send({
        name: 'Back & Legs',
        exercises: [
          { name: 'Barbell Row', catalog_id: rowId },
          { name: 'Back Squat', catalog_id: squatId },
        ],
      })
      .expect(201);
    await author.post(`/workout-templates/${big.body.data.id}/publish`).expect(200);

    const small = await author
      .post('/workout-templates')
      .send({ name: 'Just Rows', exercises: [{ name: 'Barbell Row', catalog_id: rowId }] })
      .expect(201);
    await author.post(`/workout-templates/${small.body.data.id}/publish`).expect(200);

    // A different user who has trained nothing — back & quads are weak.
    const user = await registerAgent('ruser@example.com');
    const res = await user.get('/recommendations').expect(200);

    const suggestions = res.body.data.suggested_templates;
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
    // Highest weak-area coverage first.
    expect(suggestions[0].template.name).toBe('Back & Legs');
    expect(suggestions[0].matched_muscles).toEqual(
      expect.arrayContaining(['back', 'quads'])
    );
    expect(suggestions[0].score).toBeGreaterThan(suggestions[1].score);
    expect(suggestions[0].template.author.display_name).toMatch(/^Lifter \d+$/);
  });
});
