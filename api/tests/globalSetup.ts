import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Isolated test DB (under the gitignored data/ dir), rebuilt from the real
// migrations before the suite runs and removed afterward.
const TEST_DB = './data/test.db';

function removeDbFiles(): void {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.rmSync(path.resolve(process.cwd(), TEST_DB + suffix), { force: true });
    } catch {
      // On Windows the DB handle may linger at teardown (EPERM). Best-effort:
      // the file is left empty (cleared by afterEach) and removed at next setup.
    }
  }
}

export default function setup() {
  removeDbFiles();
  // Apply migrations to the fresh test DB using the same path as production.
  execSync('npx knex --knexfile knexfile.ts migrate:latest', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_PATH: TEST_DB },
    stdio: 'inherit',
  });

  return () => {
    removeDbFiles();
  };
}
