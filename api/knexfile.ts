import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import type { Knex } from 'knex';

// Knex is used for MIGRATIONS ONLY. Runtime queries use the synchronous
// better-sqlite3 API directly (see src/db). Keep this file decoupled from
// src/config so migrations don't require the full app env (e.g. SESSION_SECRET).
const databasePath = process.env.DATABASE_PATH
  ? path.resolve(__dirname, process.env.DATABASE_PATH)
  : path.resolve(__dirname, 'data', 'cadance.db');

// better-sqlite3 creates the file but not the directory.
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const config: Knex.Config = {
  client: 'better-sqlite3',
  connection: { filename: databasePath },
  useNullAsDefault: true,
  migrations: {
    directory: path.resolve(__dirname, 'src', 'db', 'migrations'),
    extension: 'ts',
  },
};

export default config;
