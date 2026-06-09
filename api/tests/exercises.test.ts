import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { app, resetDb, registerAgent } from './helpers';

afterEach(resetDb);

const benchDay = {
  type: 'strength',
  date: '2026-06-01',
  exercises: [
    { name: 'Bench Press', sets: [{ reps: 5, weight_kg: 80 }, { reps: 5, weight_kg: 80 }] },
    { name: 'Row', sets: [{ reps: 8, weight_kg: 60 }] },
  ],
};
const benchDay2 = {
  type: 'strength',
  date: '2026-06-08',
  exercises: [{ name: 'bench press', sets: [{ reps: 5, weight_kg: 85 }] }],
};

describe('exercises', () => {
  it('returns exercises (as rows, ordered) embedded in the strength workout', async () => {
    const agent = await registerAgent('e1@example.com');
    const res = await agent.post('/workouts').send(benchDay).expect(201);

    expect(res.body.data.details).toBeUndefined();
    expect(res.body.data.exercises).toHaveLength(2);
    expect(res.body.data.exercises[0]).toMatchObject({ name: 'Bench Press', position: 0 });
    expect(res.body.data.exercises[0].sets).toHaveLength(2);
    expect(res.body.data.exercises[1]).toMatchObject({ name: 'Row', position: 1 });

    const got = await agent.get(`/workouts/${res.body.data.id}`).expect(200);
    expect(got.body.data.exercises).toHaveLength(2);
  });

  it('lists exercise history across workouts, case-insensitively by name', async () => {
    const agent = await registerAgent('e2@example.com');
    await agent.post('/workouts').send(benchDay).expect(201);
    await agent.post('/workouts').send(benchDay2).expect(201);

    const all = await agent.get('/exercises').expect(200);
    expect(all.body.data).toHaveLength(3); // 2 + 1

    // "Bench Press" + "bench press" collapse under a case-insensitive filter.
    const bench = await agent.get('/exercises?name=Bench%20Press').expect(200);
    expect(bench.body.data).toHaveLength(2);
    expect(bench.body.data[0].date).toBe('2026-06-08'); // newest first
    expect(bench.body.data.every((e: { name: string }) => /bench press/i.test(e.name))).toBe(true);

    const names = await agent.get('/exercises/names').expect(200);
    // Distinct, but COLLATE NOCASE keeps both spellings out — at least Row + a bench entry.
    expect(names.body.data).toContain('Row');
  });

  it('replaces exercises on update and clears them when switching away from strength', async () => {
    const agent = await registerAgent('e3@example.com');
    const created = await agent.post('/workouts').send(benchDay).expect(201);
    const id = created.body.data.id;

    const updated = await agent
      .put(`/workouts/${id}`)
      .send({ type: 'strength', date: '2026-06-01', exercises: [{ name: 'Squat', sets: [{ reps: 3, weight_kg: 120 }] }] })
      .expect(200);
    expect(updated.body.data.exercises).toHaveLength(1);
    expect(updated.body.data.exercises[0].name).toBe('Squat');

    // Switch to cardio — exercises should be gone.
    const toRun = await agent
      .put(`/workouts/${id}`)
      .send({ type: 'run', date: '2026-06-01', details: { distance_km: 5 } })
      .expect(200);
    expect(toRun.body.data.exercises).toBeUndefined();
    expect(toRun.body.data.details.distance_km).toBe(5);

    const history = await agent.get('/exercises').expect(200);
    expect(history.body.data).toHaveLength(0);
  });

  it('cascades: deleting a workout removes its exercises', async () => {
    const agent = await registerAgent('e4@example.com');
    const created = await agent.post('/workouts').send(benchDay).expect(201);
    await agent.get('/exercises').expect(200).then((r) => expect(r.body.data).toHaveLength(2));

    await agent.delete(`/workouts/${created.body.data.id}`).expect(200);
    const after = await agent.get('/exercises').expect(200);
    expect(after.body.data).toHaveLength(0);
  });

  it('enforces ownership: another user sees no exercises', async () => {
    const alice = await registerAgent('ea@example.com');
    const bob = await registerAgent('eb@example.com');
    await alice.post('/workouts').send(benchDay).expect(201);

    const bobEx = await bob.get('/exercises').expect(200);
    expect(bobEx.body.data).toHaveLength(0);
    await request(app).get('/exercises').expect(401);
  });
});
