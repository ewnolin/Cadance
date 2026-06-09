import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { app, resetDb, registerAgent } from './helpers';

afterEach(resetDb);

/** Grab a public catalog entry's id for linking tests. */
async function aCatalogId(agent: ReturnType<typeof request.agent>): Promise<number> {
  const res = await agent.get('/exercises/catalog?q=Back%20Squat').expect(200);
  return res.body.data[0].id as number;
}

describe('workout templates', () => {
  it('requires authentication', async () => {
    await request(app).get('/workout-templates').expect(401);
  });

  it('creates a template with ordered exercises and reads it back', async () => {
    const agent = await registerAgent('t1@example.com');
    const catalogId = await aCatalogId(agent);

    const created = await agent
      .post('/workout-templates')
      .send({
        name: 'Pass A — Heavy',
        notes: 'Max strength, long rest',
        exercises: [
          { name: 'Back Squat', catalog_id: catalogId, target_sets: 4, target_reps: '5', notes: '@85%' },
          { name: 'Bench Press', target_sets: 5, target_reps: '3' },
        ],
      })
      .expect(201);

    expect(created.body.data).toMatchObject({ name: 'Pass A — Heavy', notes: 'Max strength, long rest' });
    expect(created.body.data.exercises).toHaveLength(2);
    expect(created.body.data.exercises[0]).toMatchObject({
      name: 'Back Squat',
      catalog_id: catalogId,
      position: 0,
      target_sets: 4,
      target_reps: '5',
      notes: '@85%',
    });
    expect(created.body.data.exercises[1]).toMatchObject({
      name: 'Bench Press',
      catalog_id: null,
      position: 1,
    });

    const got = await agent.get(`/workout-templates/${created.body.data.id}`).expect(200);
    expect(got.body.data.exercises).toHaveLength(2);
  });

  it('lists templates alphabetically and allows an empty exercise list', async () => {
    const agent = await registerAgent('t2@example.com');
    await agent.post('/workout-templates').send({ name: 'Zercher Day' }).expect(201);
    await agent.post('/workout-templates').send({ name: 'Arms' }).expect(201);

    const list = await agent.get('/workout-templates').expect(200);
    expect(list.body.data.map((t: { name: string }) => t.name)).toEqual(['Arms', 'Zercher Day']);
    expect(list.body.data[0].exercises).toEqual([]);
  });

  it('rejects an empty name and an unknown catalog reference', async () => {
    const agent = await registerAgent('t3@example.com');
    await agent.post('/workout-templates').send({ name: '   ' }).expect(400);

    await agent
      .post('/workout-templates')
      .send({ name: 'Bad ref', exercises: [{ name: 'Ghost', catalog_id: 999999 }] })
      .expect(400);
  });

  it("rejects another user's private catalog entry as a reference", async () => {
    const alice = await registerAgent('ta@example.com');
    const bob = await registerAgent('tb@example.com');

    const custom = await alice
      .post('/exercises/catalog')
      .send({ name: 'Alice Curl', primary_muscles: ['biceps'] })
      .expect(201);

    // Bob can't reference Alice's private entry.
    await bob
      .post('/workout-templates')
      .send({ name: 'Steal', exercises: [{ name: 'Alice Curl', catalog_id: custom.body.data.id }] })
      .expect(400);
  });

  it('replaces exercises on update and enforces ownership', async () => {
    const alice = await registerAgent('tc@example.com');
    const bob = await registerAgent('td@example.com');

    const created = await alice
      .post('/workout-templates')
      .send({ name: 'Day 1', exercises: [{ name: 'Squat', target_sets: 3 }] })
      .expect(201);
    const id = created.body.data.id;

    const updated = await alice
      .put(`/workout-templates/${id}`)
      .send({ name: 'Day 1 v2', exercises: [{ name: 'Deadlift', target_sets: 1 }] })
      .expect(200);
    expect(updated.body.data.name).toBe('Day 1 v2');
    expect(updated.body.data.exercises).toHaveLength(1);
    expect(updated.body.data.exercises[0].name).toBe('Deadlift');

    // Bob sees / touches nothing of Alice's.
    await bob.get(`/workout-templates/${id}`).expect(404);
    await bob.put(`/workout-templates/${id}`).send({ name: 'x' }).expect(404);
    await bob.delete(`/workout-templates/${id}`).expect(404);

    const bobList = await bob.get('/workout-templates').expect(200);
    expect(bobList.body.data).toHaveLength(0);
  });

  it('deletes a template (exercises cascade)', async () => {
    const agent = await registerAgent('t5@example.com');
    const created = await agent
      .post('/workout-templates')
      .send({ name: 'Throwaway', exercises: [{ name: 'Plank' }] })
      .expect(201);

    await agent.delete(`/workout-templates/${created.body.data.id}`).expect(200);
    await agent.get(`/workout-templates/${created.body.data.id}`).expect(404);
  });

  it('includes templates and custom exercises in the GDPR export', async () => {
    const agent = await registerAgent('t6@example.com');
    await agent
      .post('/exercises/catalog')
      .send({ name: 'My Special', primary_muscles: ['core'] })
      .expect(201);
    await agent
      .post('/workout-templates')
      .send({ name: 'Exported Day', exercises: [{ name: 'Plank' }] })
      .expect(201);

    const dump = await agent.get('/account/export').expect(200);
    expect(dump.body.data.workout_templates.map((t: { name: string }) => t.name)).toContain(
      'Exported Day'
    );
    expect(dump.body.data.custom_exercises.map((e: { name: string }) => e.name)).toContain(
      'My Special'
    );
    // Public seeds are not the user's data — excluded from the export.
    expect(dump.body.data.custom_exercises.map((e: { name: string }) => e.name)).not.toContain(
      'Deadlift'
    );
  });
});
