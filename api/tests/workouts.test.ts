import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { app, resetDb, registerAgent } from './helpers';

afterEach(resetDb);

const strength = {
  type: 'strength',
  date: '2026-06-08',
  duration_s: 3600,
  exercises: [{ name: 'Squat', sets: [{ reps: 5, weight_kg: 100 }] }],
};
const cycle = {
  type: 'cycle',
  date: '2026-06-07',
  details: { distance_km: 40.2, elevation_m: 350 },
};

describe('workouts', () => {
  it('requires authentication', async () => {
    await request(app).get('/workouts').expect(401);
  });

  it('creates workouts of different types (cardio shape shared by run/cycle)', async () => {
    const agent = await registerAgent('w@example.com');
    const s = await agent.post('/workouts').send(strength).expect(201);
    expect(s.body.data.type).toBe('strength');
    expect(s.body.data.exercises).toHaveLength(1);
    expect(s.body.data.exercises[0]).toMatchObject({ name: 'Squat', position: 0 });

    const c = await agent.post('/workouts').send(cycle).expect(201);
    expect(c.body.data.type).toBe('cycle');
    expect(c.body.data.details.distance_km).toBe(40.2);
  });

  it('rejects an unknown type and invalid details', async () => {
    const agent = await registerAgent('w2@example.com');
    await agent.post('/workouts').send({ type: 'swim', date: '2026-06-08', details: {} }).expect(400);
    await agent
      .post('/workouts')
      .send({ type: 'yoga', date: '2026-06-08', details: { style: 'Yin', intensity: 'extreme' } })
      .expect(400);
  });

  it('lists workouts and filters by type', async () => {
    const agent = await registerAgent('w3@example.com');
    await agent.post('/workouts').send(strength).expect(201);
    await agent.post('/workouts').send(cycle).expect(201);

    const all = await agent.get('/workouts').expect(200);
    expect(all.body.data).toHaveLength(2);

    const cyclesOnly = await agent.get('/workouts?type=cycle').expect(200);
    expect(cyclesOnly.body.data).toHaveLength(1);
    expect(cyclesOnly.body.data[0].type).toBe('cycle');

    await agent.get('/workouts?type=bogus').expect(400);
  });

  it('enforces ownership: a user cannot read or update another user\'s workout', async () => {
    const alice = await registerAgent('alice@example.com');
    const bob = await registerAgent('bob@example.com');

    const created = await alice.post('/workouts').send(strength).expect(201);
    const id = created.body.data.id;

    await bob.get(`/workouts/${id}`).expect(404);
    await bob.put(`/workouts/${id}`).send(cycle).expect(404);
    await bob.delete(`/workouts/${id}`).expect(404);

    // Owner still can.
    await alice.get(`/workouts/${id}`).expect(200);
  });

  it('records a session feel and per-set RPE, round-tripping both', async () => {
    const agent = await registerAgent('w5@example.com');
    const created = await agent
      .post('/workouts')
      .send({
        type: 'strength',
        date: '2026-06-08',
        feel: 'hard',
        exercises: [
          {
            name: 'Bench Press',
            sets: [
              { reps: 5, weight_kg: 80, rpe: 8 },
              { reps: 5, weight_kg: 80, rpe: 9.5 },
              { reps: 5, weight_kg: 80 }, // rpe optional
            ],
          },
        ],
      })
      .expect(201);

    expect(created.body.data.feel).toBe('hard');
    const sets = created.body.data.exercises[0].sets;
    expect(sets[0].rpe).toBe(8);
    expect(sets[1].rpe).toBe(9.5);
    expect(sets[2].rpe ?? null).toBeNull();

    // Feel applies to non-strength types too.
    const ride = await agent
      .post('/workouts')
      .send({ ...cycle, feel: 'easy' })
      .expect(201);
    expect(ride.body.data.feel).toBe('easy');
  });

  it('defaults feel to null and rejects invalid feel/RPE values', async () => {
    const agent = await registerAgent('w6@example.com');
    const created = await agent.post('/workouts').send(strength).expect(201);
    expect(created.body.data.feel).toBeNull();

    await agent
      .post('/workouts')
      .send({ type: 'strength', date: '2026-06-08', feel: 'destroyed', exercises: [] })
      .expect(400);

    // RPE must be 1–10 in half steps.
    await agent
      .post('/workouts')
      .send({
        type: 'strength',
        date: '2026-06-08',
        exercises: [{ name: 'Squat', sets: [{ reps: 5, weight_kg: 100, rpe: 11 }] }],
      })
      .expect(400);
    await agent
      .post('/workouts')
      .send({
        type: 'strength',
        date: '2026-06-08',
        exercises: [{ name: 'Squat', sets: [{ reps: 5, weight_kg: 100, rpe: 8.3 }] }],
      })
      .expect(400);
  });

  it('clears feel when an update omits it', async () => {
    const agent = await registerAgent('w7@example.com');
    const created = await agent
      .post('/workouts')
      .send({ ...cycle, feel: 'max' })
      .expect(201);
    expect(created.body.data.feel).toBe('max');

    const updated = await agent
      .put(`/workouts/${created.body.data.id}`)
      .send(cycle) // no feel field
      .expect(200);
    expect(updated.body.data.feel).toBeNull();
  });

  it('links a logged exercise to a catalog entry and rejects bad references', async () => {
    const agent = await registerAgent('w8@example.com');
    const cat = await agent
      .get('/exercises/catalog?q=Barbell%20Bench%20Press')
      .expect(200);
    const catalogId = cat.body.data[0].id as number;

    const created = await agent
      .post('/workouts')
      .send({
        type: 'strength',
        date: '2026-06-08',
        exercises: [
          { name: 'Barbell Bench Press', catalog_id: catalogId, sets: [{ reps: 5, weight_kg: 80 }] },
        ],
      })
      .expect(201);
    expect(created.body.data.exercises[0].catalog_id).toBe(catalogId);

    // Dangling catalog id is rejected.
    await agent
      .post('/workouts')
      .send({
        type: 'strength',
        date: '2026-06-08',
        exercises: [{ name: 'Ghost', catalog_id: 999999, sets: [{ reps: 5, weight_kg: 20 }] }],
      })
      .expect(400);
  });

  it("rejects another user's private catalog entry on a logged exercise", async () => {
    const alice = await registerAgent('wa2@example.com');
    const bob = await registerAgent('wb2@example.com');
    const custom = await alice
      .post('/exercises/catalog')
      .send({ name: 'Alice Move', primary_muscles: ['chest'] })
      .expect(201);

    await bob
      .post('/workouts')
      .send({
        type: 'strength',
        date: '2026-06-08',
        exercises: [{ name: 'Alice Move', catalog_id: custom.body.data.id, sets: [{ reps: 5, weight_kg: 10 }] }],
      })
      .expect(400);
  });

  it('updates and deletes a workout', async () => {
    const agent = await registerAgent('w4@example.com');
    const created = await agent.post('/workouts').send(cycle).expect(201);
    const id = created.body.data.id;

    const updated = await agent
      .put(`/workouts/${id}`)
      .send({ type: 'run', date: '2026-06-06', details: { distance_km: 8 } })
      .expect(200);
    expect(updated.body.data.type).toBe('run');
    expect(updated.body.data.details.distance_km).toBe(8);

    await agent.delete(`/workouts/${id}`).expect(200);
    await agent.get(`/workouts/${id}`).expect(404);
  });
});
