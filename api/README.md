# Cadance API

Express 5 + TypeScript backend for Cadance. SQLite via better-sqlite3 (sync
runtime queries); schema changes go through Knex migrations.

## Setup

```bash
cd api
npm install
cp .env.example .env   # then edit SESSION_SECRET etc.
npm run migrate        # create the SQLite schema
npm run dev            # start with nodemon + ts-node
```

## Scripts

| Script                  | What it does                              |
| ----------------------- | ----------------------------------------- |
| `npm run dev`           | Dev server (nodemon + ts-node)            |
| `npm run build`         | Compile TypeScript to `dist/`             |
| `npm start`             | Run the compiled server (`dist/index.js`) |
| `npm run migrate`       | Apply all pending migrations              |
| `npm run migrate:make`  | Scaffold a new migration (`-- <name>`)    |
| `npm run migrate:rollback` | Roll back the last migration batch     |
| `npm test`              | Run the Vitest integration suite          |
| `npm run test:watch`    | Run the suite in watch mode               |

## Testing

Integration tests live in `tests/` and exercise the real HTTP surface with
Supertest against an isolated SQLite DB (`data/test.db`), rebuilt from the
actual migrations before each run (see `tests/globalSetup.ts`). Auth uses a
cookie-persisting Supertest agent; data is reset between tests. Rate limiting is
skipped under `NODE_ENV=test`.

## Endpoints

All responses use a `{ data, error }` envelope. Auth is cookie-session based
(`cadance.sid`); send requests with credentials included.

### Auth
- `POST /auth/register` — `{ email, password }` → creates account, starts session
- `POST /auth/login` — `{ email, password }` → starts session
- `POST /auth/logout` — ends session
- `GET  /auth/me` — current user (requires session)

### Account management
- `POST   /account/change-password` — `{ currentPassword, newPassword }`
- `POST   /account/change-email` — `{ email, password }`
- `GET    /account/export` — **GDPR data portability**: full JSON export
- `DELETE /account` — **GDPR erasure**: `{ password }`, hard-deletes the account

### Workouts (all require a session; scoped to the current user)
Workouts are **polymorphic** by `type`: a shared core (`date`, `duration_s`,
`notes`) plus a type-specific `details` payload. Supported types: `strength`,
`run`, `cycle`, `yoga`. Adding a new type is a new zod variant in
`src/lib/validation.ts` — no migration, no new route.

- `GET    /workouts[?type=run]` — list the user's workouts (newest first; optional type filter)
- `POST   /workouts` — create (see shapes below)
- `GET    /workouts/:id` — fetch one
- `PUT    /workouts/:id` — replace
- `DELETE /workouts/:id` — remove

Body shapes (all take `date`, optional `duration_s`, optional `notes`):

```jsonc
// strength
{ "type": "strength", "date": "2026-06-08", "duration_s": 3600,
  "details": { "exercises": [ { "name": "Squat", "sets": [ { "reps": 5, "weight_kg": 100 } ] } ] } }

// run / cycle (same cardio shape)
{ "type": "cycle", "date": "2026-06-08", "duration_s": 5400,
  "details": { "distance_km": 40.2, "elevation_m": 350 } }

// yoga
{ "type": "yoga", "date": "2026-06-08", "duration_s": 1800,
  "details": { "style": "Vinyasa", "intensity": "moderate" } }
```

### Food logs (all require a session; scoped to the current user)
- `GET    /food-logs[?date=YYYY-MM-DD]` — list entries (optional date filter)
- `GET    /food-logs/summary[?date=YYYY-MM-DD]` — daily nutrition totals (defaults to today)
- `POST   /food-logs` — create
- `GET    /food-logs/:id` — fetch one
- `PUT    /food-logs/:id` — replace
- `DELETE /food-logs/:id` — remove

```jsonc
// create / replace body — meal is breakfast|lunch|dinner|snack; macros in grams (default 0)
{ "date": "2026-06-08", "meal": "lunch", "name": "Chicken & rice",
  "calories": 650, "protein": 45, "carbs": 70, "fat": 12 }

// summary response data
{ "date": "2026-06-08", "count": 3, "calories": 1850, "protein": 120, "carbs": 180, "fat": 55 }
```

## Security & data protection notes

- Passwords hashed with **argon2id** only.
- Login uses generic errors + constant-time dummy verification to resist user
  enumeration.
- Session cookies: `httpOnly`, `sameSite=lax`, `secure` in production, rolling
  expiry. Session id is regenerated on login/register and password change.
- Brute-force protection via per-IP rate limiting on credential endpoints.
- Passwords require ≥12 characters (length-first policy, NIST 800-63B).
- **GDPR**: users can export all their data (`/account/export`) and erase their
  account (`DELETE /account`). Related tables should use `ON DELETE CASCADE` so
  erasure removes everything. Only email + password hash are stored about a user.

> Sessions are stored in a `sessions` table created/managed by
> `better-sqlite3-session-store` (not by Knex migrations).
