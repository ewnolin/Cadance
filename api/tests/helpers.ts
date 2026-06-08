import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/db';

// One app instance (and thus one session store) shared across the suite.
export const app = createApp();

export const VALID_PASSWORD = 'passwordpassword';

/** Wipe all data between tests. Deleting users cascades to workouts/food_logs. */
export function resetDb(): void {
  db.exec('DELETE FROM users');
  try {
    db.exec('DELETE FROM sessions');
  } catch {
    // sessions table is created lazily by the store; ignore if absent.
  }
}

/** Register a user and return a cookie-persisting agent that's logged in. */
export async function registerAgent(
  email = 'user@example.com',
  password = VALID_PASSWORD
) {
  const agent = request.agent(app);
  await agent.post('/auth/register').send({ email, password }).expect(201);
  return agent;
}
