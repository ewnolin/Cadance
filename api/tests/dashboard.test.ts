import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { app, resetDb, registerAgent } from './helpers';

afterEach(resetDb);

// Compute dates relative to "today" so the streak assertions hold on any day.
function addDays(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
const today = new Date().toISOString().slice(0, 10);
const yesterday = addDays(today, -1);
const fourDaysAgo = addDays(today, -4);

describe('dashboard', () => {
  it('requires authentication', async () => {
    await request(app).get('/dashboard').expect(401);
  });

  it('validates the days param', async () => {
    const agent = await registerAgent('d0@example.com');
    await agent.get('/dashboard?days=0').expect(400);
    await agent.get('/dashboard?days=40').expect(400);
    await agent.get('/dashboard?days=abc').expect(400);
    const ok = await agent.get('/dashboard?days=14').expect(200);
    expect(ok.body.data.range.days).toBe(14);
    expect(ok.body.data.daily).toHaveLength(14);
  });

  it('summarizes workouts and nutrition with streaks and a daily breakdown', async () => {
    const agent = await registerAgent('d1@example.com');

    // Workouts: strength today + run yesterday (consecutive => streak 2).
    await agent
      .post('/workouts')
      .send({ type: 'strength', date: today, duration_s: 3600, exercises: [] })
      .expect(201);
    await agent
      .post('/workouts')
      .send({ type: 'run', date: yesterday, duration_s: 1800, details: { distance_km: 5 } })
      .expect(201);

    // Food: two entries today (streak 1) + one four days ago (not consecutive).
    await agent
      .post('/food-logs')
      .send({ date: today, meal: 'breakfast', name: 'Oats', calories: 300, protein: 10 })
      .expect(201);
    await agent
      .post('/food-logs')
      .send({ date: today, meal: 'lunch', name: 'Apple', calories: 100 })
      .expect(201);
    await agent
      .post('/food-logs')
      .send({ date: fourDaysAgo, meal: 'dinner', name: 'Pasta', calories: 700 })
      .expect(201);

    const res = await agent.get('/dashboard').expect(200);
    const d = res.body.data;

    expect(d.range.days).toBe(7);
    expect(d.daily).toHaveLength(7);
    expect(d.range.to).toBe(today);

    expect(d.workouts.total).toBe(2);
    expect(d.workouts.total_duration_s).toBe(5400);
    expect(d.workouts.by_type).toMatchObject({ strength: 1, run: 1, cycle: 0, yoga: 0 });

    expect(d.nutrition.days_logged).toBe(2); // today + four days ago
    expect(d.nutrition.total_calories).toBe(1100);
    expect(d.nutrition.avg_calories_per_logged_day).toBe(550);

    expect(d.streaks.workouts).toBe(2); // today + yesterday
    expect(d.streaks.nutrition).toBe(1); // only today is consecutive

    const todayCell = d.daily.find((c: { date: string }) => c.date === today);
    expect(todayCell).toMatchObject({ workouts: 1, calories: 400 });
  });

  it('is empty for a user with no data', async () => {
    const agent = await registerAgent('d2@example.com');
    const res = await agent.get('/dashboard').expect(200);
    expect(res.body.data.workouts.total).toBe(0);
    expect(res.body.data.streaks).toMatchObject({ workouts: 0, nutrition: 0 });
    expect(res.body.data.nutrition.avg_calories_per_logged_day).toBe(0);
  });
});
