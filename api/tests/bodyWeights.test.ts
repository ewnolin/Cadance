import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { app, resetDb, registerAgent } from './helpers';

afterEach(resetDb);

describe('body weights', () => {
  it('requires authentication', async () => {
    await request(app).get('/body-weights').expect(401);
  });

  it('logs a weigh-in and lists oldest→newest', async () => {
    const agent = await registerAgent('bw1@example.com');
    await agent
      .post('/body-weights')
      .send({ date: '2026-06-02', weight_kg: 83 })
      .expect(201);
    const created = await agent
      .post('/body-weights')
      .send({ date: '2026-06-05', weight_kg: 82.4, note: 'morning' })
      .expect(201);
    expect(created.body.data).toMatchObject({ weight_kg: 82.4, note: 'morning' });

    const list = await agent.get('/body-weights').expect(200);
    expect(list.body.data.map((w: { date: string }) => w.date)).toEqual([
      '2026-06-02',
      '2026-06-05',
    ]);
  });

  it('replaces the entry for a date instead of duplicating it', async () => {
    const agent = await registerAgent('bw2@example.com');
    await agent.post('/body-weights').send({ date: '2026-06-05', weight_kg: 82 }).expect(201);
    await agent.post('/body-weights').send({ date: '2026-06-05', weight_kg: 81.6 }).expect(201);

    const list = await agent.get('/body-weights').expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].weight_kg).toBe(81.6);
  });

  it('filters by date range', async () => {
    const agent = await registerAgent('bw3@example.com');
    for (const [date, kg] of [
      ['2026-05-20', 84],
      ['2026-06-01', 83],
      ['2026-06-10', 82],
    ] as const) {
      await agent.post('/body-weights').send({ date, weight_kg: kg }).expect(201);
    }
    const ranged = await agent
      .get('/body-weights?from=2026-06-01&to=2026-06-30')
      .expect(200);
    expect(ranged.body.data.map((w: { date: string }) => w.date)).toEqual([
      '2026-06-01',
      '2026-06-10',
    ]);

    await agent.get('/body-weights?from=2026-06-01').expect(400); // needs both
  });

  it('validates the weight and date', async () => {
    const agent = await registerAgent('bw4@example.com');
    await agent.post('/body-weights').send({ date: '2026-06-05', weight_kg: 0 }).expect(400);
    await agent.post('/body-weights').send({ date: '2026-06-05', weight_kg: 999 }).expect(400);
    await agent.post('/body-weights').send({ date: 'June 5', weight_kg: 80 }).expect(400);
  });

  it('deletes a weigh-in and enforces ownership', async () => {
    const alice = await registerAgent('bwa@example.com');
    const bob = await registerAgent('bwb@example.com');
    const created = await alice
      .post('/body-weights')
      .send({ date: '2026-06-05', weight_kg: 82 })
      .expect(201);
    const id = created.body.data.id;

    await bob.delete(`/body-weights/${id}`).expect(404); // not Bob's
    const bobList = await bob.get('/body-weights').expect(200);
    expect(bobList.body.data).toHaveLength(0);

    await alice.delete(`/body-weights/${id}`).expect(200);
    const after = await alice.get('/body-weights').expect(200);
    expect(after.body.data).toHaveLength(0);
  });

  it('includes weigh-ins in the GDPR export', async () => {
    const agent = await registerAgent('bw5@example.com');
    await agent.post('/body-weights').send({ date: '2026-06-05', weight_kg: 82 }).expect(201);
    const dump = await agent.get('/account/export').expect(200);
    expect(dump.body.data.body_weights).toHaveLength(1);
    expect(dump.body.data.body_weights[0].weight_kg).toBe(82);
  });
});
