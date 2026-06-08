import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    // Tests share one SQLite test DB, so run files serially for deterministic state.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      SESSION_SECRET: 'test-session-secret-at-least-16-chars',
      DATABASE_PATH: './data/test.db',
      CORS_ORIGIN: 'http://localhost',
    },
  },
});
