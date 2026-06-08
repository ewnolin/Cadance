import { describe, it, expect, afterEach } from 'vitest';
import { app, resetDb, registerAgent } from './helpers';

afterEach(resetDb);

describe('food logs', () => {
  it('creates an entry and defaults macros to 0', async () => {
    const agent = await registerAgent('f@example.com');
    const res = await agent
      .post('/food-logs')
      .send({ date: '2026-06-08', meal: 'lunch', name: 'Apple', calories: 95 })
      .expect(201);
    expect(res.body.data).toMatchObject({
      name: 'Apple',
      calories: 95,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it('rejects an invalid meal and negative calories', async () => {
    const agent = await registerAgent('f2@example.com');
    await agent
      .post('/food-logs')
      .send({ date: '2026-06-08', meal: 'brunch', name: 'X', calories: 100 })
      .expect(400);
    await agent
      .post('/food-logs')
      .send({ date: '2026-06-08', meal: 'snack', name: 'X', calories: -5 })
      .expect(400);
  });

  it('lists by date and summarizes daily totals', async () => {
    const agent = await registerAgent('f3@example.com');
    await agent
      .post('/food-logs')
      .send({ date: '2026-06-08', meal: 'breakfast', name: 'Oats', calories: 350, protein: 12, carbs: 60, fat: 6 })
      .expect(201);
    await agent
      .post('/food-logs')
      .send({ date: '2026-06-08', meal: 'lunch', name: 'Apple', calories: 95 })
      .expect(201);
    await agent
      .post('/food-logs')
      .send({ date: '2026-06-07', meal: 'dinner', name: 'Pasta', calories: 700 })
      .expect(201);

    const onDate = await agent.get('/food-logs?date=2026-06-08').expect(200);
    expect(onDate.body.data).toHaveLength(2);

    const summary = await agent.get('/food-logs/summary?date=2026-06-08').expect(200);
    expect(summary.body.data).toMatchObject({
      date: '2026-06-08',
      count: 2,
      calories: 445,
      protein: 12,
      carbs: 60,
      fat: 6,
    });
  });

  it('enforces ownership across users', async () => {
    const alice = await registerAgent('a2@example.com');
    const bob = await registerAgent('b2@example.com');

    const created = await alice
      .post('/food-logs')
      .send({ date: '2026-06-08', meal: 'lunch', name: 'Secret', calories: 500 })
      .expect(201);
    const id = created.body.data.id;

    await bob.get(`/food-logs/${id}`).expect(404);
    const bobSummary = await bob.get('/food-logs/summary?date=2026-06-08').expect(200);
    expect(bobSummary.body.data.count).toBe(0);
  });
});
