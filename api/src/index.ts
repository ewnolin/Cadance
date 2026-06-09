import type { Server } from 'node:http';
import { createApp } from './app';
import { config } from './config';
import { db } from './db';

const app = createApp();

const server: Server = app.listen(config.port, () => {
  console.log(
    `Cadance API listening on http://localhost:${config.port} (${config.nodeEnv})`
  );
});

// Graceful shutdown: stop accepting connections, then close the SQLite handle
// (which checkpoints the WAL) before exiting. Matters for clean container stops.
let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received — shutting down gracefully...`);

  server.close((err) => {
    if (err) {
      console.error('Error during server close:', err);
      process.exitCode = 1;
    }
    try {
      db.close();
    } catch (e) {
      console.error('Error closing database:', e);
    }
    console.log('Shutdown complete.');
    process.exit();
  });

  // Don't hang forever if connections refuse to drain.
  setTimeout(() => {
    console.error('Could not close in time — forcing shutdown.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
