import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import session from 'express-session';
import SqliteStoreFactory from 'better-sqlite3-session-store';
import { config } from './config';
import { db } from './db';
import { authRouter } from './routes/auth';
import { accountRouter } from './routes/account';
import { workoutsRouter } from './routes/workouts';
import { foodLogsRouter } from './routes/foodLogs';
import { dashboardRouter } from './routes/dashboard';
import { exercisesRouter } from './routes/exercises';
import { workoutTemplatesRouter } from './routes/workoutTemplates';
import { libraryRouter } from './routes/library';
import { profileRouter } from './routes/profile';
import { recommendationsRouter } from './routes/recommendations';
import { bodyWeightsRouter } from './routes/bodyWeights';
import { ok, fail } from './lib/respond';
import { requestLogger } from './middleware/requestLogger';

export function createApp() {
  const app = express();

  // Behind Caddy (TLS terminated upstream): trust the first proxy so secure
  // cookies and the real client IP (for rate limiting) work.
  app.set('trust proxy', 1);

  app.use(requestLogger);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));

  // Persistent session store in the same SQLite database, so logins survive
  // restarts. The store manages its own `sessions` table (not via Knex).
  const SqliteStore = SqliteStoreFactory(session);
  app.use(
    session({
      store: new SqliteStore({
        client: db,
        expired: { clear: true, intervalMs: 15 * 60 * 1000 },
      }),
      name: 'cadance.sid',
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProd,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    })
  );

  app.get('/health', (_req, res) => {
    ok(res, { status: 'ok' });
  });

  app.use('/auth', authRouter);
  app.use('/account', accountRouter);
  app.use('/workouts', workoutsRouter);
  app.use('/food-logs', foodLogsRouter);
  app.use('/dashboard', dashboardRouter);
  app.use('/exercises', exercisesRouter);
  app.use('/workout-templates', workoutTemplatesRouter);
  app.use('/library', libraryRouter);
  app.use('/profile', profileRouter);
  app.use('/recommendations', recommendationsRouter);
  app.use('/body-weights', bodyWeightsRouter);

  // 404 fallback.
  app.use((_req, res) => {
    fail(res, 404, 'Not found');
  });

  // Central error handler — keeps the { data, error } envelope and hides internals.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    fail(res, 500, 'Internal server error');
  });

  return app;
}
