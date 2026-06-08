import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { config } from '../config';

// Ensure the directory for the SQLite file exists (better-sqlite3 creates the
// file but not its parent directory).
fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const db = new Database(config.databasePath);

// WAL gives better read/write concurrency; foreign_keys must be enabled per
// connection so ON DELETE CASCADE works once related tables are added.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
