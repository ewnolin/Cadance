import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { app, resetDb, registerAgent, VALID_PASSWORD } from './helpers';

afterEach(resetDb);

describe('auth', () => {
  it('registers a user and returns the public user (no password hash)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'new@example.com', password: VALID_PASSWORD })
      .expect(201);

    expect(res.body.error).toBeNull();
    expect(res.body.data).toMatchObject({ email: 'new@example.com' });
    expect(res.body.data.password_hash).toBeUndefined();
  });

  it('rejects a too-short password', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'x@example.com', password: 'short' })
      .expect(400);
    expect(res.body.error).toMatch(/at least 12/i);
  });

  it('normalizes email (trim + lowercase)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: '  MixedCase@Example.COM ', password: VALID_PASSWORD })
      .expect(201);
    expect(res.body.data.email).toBe('mixedcase@example.com');
  });

  it('rejects a duplicate email', async () => {
    await registerAgent('dupe@example.com');
    await request(app)
      .post('/auth/register')
      .send({ email: 'dupe@example.com', password: VALID_PASSWORD })
      .expect(409);
  });

  it('logs in with correct credentials and rejects wrong ones with a generic error', async () => {
    await registerAgent('login@example.com');

    await request(app)
      .post('/auth/login')
      .send({ email: 'login@example.com', password: VALID_PASSWORD })
      .expect(200);

    const bad = await request(app)
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'wrongpassword1' })
      .expect(401);
    expect(bad.body.error).toBe('Invalid email or password.');

    // Unknown email returns the same generic error (no enumeration).
    const unknown = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrongpassword1' })
      .expect(401);
    expect(unknown.body.error).toBe('Invalid email or password.');
  });

  it('GET /auth/me requires a session and returns the user when authed', async () => {
    await request(app).get('/auth/me').expect(401);

    const agent = await registerAgent('me@example.com');
    const res = await agent.get('/auth/me').expect(200);
    expect(res.body.data.email).toBe('me@example.com');
  });

  it('logs out, ending the session', async () => {
    const agent = await registerAgent('out@example.com');
    await agent.get('/auth/me').expect(200);
    await agent.post('/auth/logout').expect(200);
    await agent.get('/auth/me').expect(401);
  });
});
