import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { app, resetDb, registerAgent } from './helpers';

afterEach(resetDb);

const strength = {
  type: 'strength',
  date: '2026-06-08',
  duration_s: 3600,
  details: { exercises: [{ name: 'Squat', sets: [{ reps: 5, weight_kg: 100 }] }] },
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
    expect(s.body.data.details.exercises).toHaveLength(1);

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
