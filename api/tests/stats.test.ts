import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { app, resetDb, registerAgent } from './helpers';

afterEach(resetDb);

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

describe('stats', () => {
  it('requires authentication', async () => {
    await request(app).get('/stats').expect(401);
  });

  it('returns zeroed stats for a new account', async () => {
    const agent = await registerAgent('s1@example.com');
    const res = await agent.get('/stats').expect(200);
    expect(res.body.data.total_workouts).toBe(0);
    expect(res.body.data.sets_this_week).toBe(0);
    expect(res.body.data.weekly).toHaveLength(6);
    expect(res.body.data.weekly.every((w: { count: number }) => w.count === 0)).toBe(true);
    expect(res.body.data.prs).toEqual([]);
  });

  it('computes totals, weekly activity, and personal records', async () => {
    const agent = await registerAgent('s2@example.com');

    // This week: a bench session with two sets (heaviest 85).
    await agent
      .post('/workouts')
      .send({
        type: 'strength',
        date: isoDaysAgo(0),
        exercises: [
          {
            name: 'Bench Press',
            sets: [
              { reps: 5, weight_kg: 80 },
              { reps: 5, weight_kg: 85 },
            ],
          },
        ],
      })
      .expect(201);

    // Two weeks ago: a heavy squat (different week bucket, not this week).
    await agent
      .post('/workouts')
      .send({
        type: 'strength',
        date: isoDaysAgo(14),
        exercises: [{ name: 'Squat', sets: [{ reps: 3, weight_kg: 100 }] }],
      })
      .expect(201);

    const res = await agent.get('/stats').expect(200);
    const data = res.body.data;

    expect(data.total_workouts).toBe(2);
    expect(data.sets_this_week).toBe(2); // only the bench session counts

    // Both workouts fall inside the 6-week window.
    const total = data.weekly.reduce((sum: number, w: { count: number }) => sum + w.count, 0);
    expect(total).toBe(2);
    expect(data.weekly[data.weekly.length - 1].count).toBe(1); // bench, current week

    // PRs sorted heaviest first; est. 1RM via Epley (85 × (1 + 5/30) ≈ 99.2).
    expect(data.prs).toHaveLength(2);
    expect(data.prs[0]).toMatchObject({ name: 'Squat', weight: 100, reps: 3 });
    const bench = data.prs.find((p: { name: string }) => p.name === 'Bench Press');
    expect(bench.weight).toBe(85);
    expect(bench.est_1rm).toBeCloseTo(99.2, 1);
  });

  it('merges case-variant exercise names in PRs', async () => {
    const agent = await registerAgent('sprs@example.com');
    await agent
      .post('/workouts')
      .send({ type: 'strength', date: isoDaysAgo(0), exercises: [{ name: 'Squat', sets: [{ reps: 5, weight_kg: 100 }] }] })
      .expect(201);
    await agent
      .post('/workouts')
      .send({ type: 'strength', date: isoDaysAgo(1), exercises: [{ name: 'squat', sets: [{ reps: 3, weight_kg: 110 }] }] })
      .expect(201);

    const res = await agent.get('/stats').expect(200);
    const squats = res.body.data.prs.filter((p: { name: string }) => /^squat$/i.test(p.name));
    expect(squats).toHaveLength(1);
    expect(squats[0].weight).toBe(110);
  });

  it('scopes stats to the requesting user', async () => {
    const alice = await registerAgent('sa@example.com');
    const bob = await registerAgent('sb@example.com');
    await alice
      .post('/workouts')
      .send({
        type: 'strength',
        date: isoDaysAgo(0),
        exercises: [{ name: 'Deadlift', sets: [{ reps: 1, weight_kg: 180 }] }],
      })
      .expect(201);

    const bobStats = await bob.get('/stats').expect(200);
    expect(bobStats.body.data.total_workouts).toBe(0);
    expect(bobStats.body.data.prs).toEqual([]);
  });
});
