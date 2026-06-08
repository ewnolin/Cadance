import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { app, resetDb, registerAgent, VALID_PASSWORD } from './helpers';

afterEach(resetDb);

describe('account management', () => {
  it('changes the password (requires the current one) and lets the user log in with the new one', async () => {
    const agent = await registerAgent('pw@example.com');

    await agent
      .post('/account/change-password')
      .send({ currentPassword: 'wrongcurrent1', newPassword: 'brandnewpassword' })
      .expect(403);

    await agent
      .post('/account/change-password')
      .send({ currentPassword: VALID_PASSWORD, newPassword: 'brandnewpassword' })
      .expect(200);

    await request(app)
      .post('/auth/login')
      .send({ email: 'pw@example.com', password: 'brandnewpassword' })
      .expect(200);
  });

  it('changes the email (requires the password)', async () => {
    const agent = await registerAgent('old@example.com');

    await agent
      .post('/account/change-email')
      .send({ email: 'fresh@example.com', password: 'wrongpassword1' })
      .expect(403);

    const res = await agent
      .post('/account/change-email')
      .send({ email: 'fresh@example.com', password: VALID_PASSWORD })
      .expect(200);
    expect(res.body.data.email).toBe('fresh@example.com');
  });

  it('exports all of the user data (GDPR portability)', async () => {
    const agent = await registerAgent('export@example.com');
    await agent
      .post('/workouts')
      .send({ type: 'yoga', date: '2026-06-08', details: { style: 'Yin', intensity: 'gentle' } })
      .expect(201);
    await agent
      .post('/food-logs')
      .send({ date: '2026-06-08', meal: 'lunch', name: 'Salad', calories: 200 })
      .expect(201);

    const res = await agent.get('/account/export').expect(200);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.body.data.account.email).toBe('export@example.com');
    expect(res.body.data.workouts).toHaveLength(1);
    expect(res.body.data.food_logs).toHaveLength(1);
  });

  it('deletes the account (GDPR erasure) and ends the session', async () => {
    const agent = await registerAgent('del@example.com');

    await agent
      .delete('/account')
      .send({ password: 'wrongpassword1' })
      .expect(403);

    await agent.delete('/account').send({ password: VALID_PASSWORD }).expect(200);
    await agent.get('/auth/me').expect(401);

    // The email is free again after erasure.
    await request(app)
      .post('/auth/register')
      .send({ email: 'del@example.com', password: VALID_PASSWORD })
      .expect(201);
  });
});
