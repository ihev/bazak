import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvironment, workspaceRoot } from '../src/config/environment.js';

function runMigrations(): void {
  const environment = loadEnvironment();
  const databasePath = resolve(workspaceRoot, environment.DATABASE_PATH);
  mkdirSync(dirname(databasePath), { recursive: true });
  const connection = new Database(databasePath);

  try {
    connection.pragma('foreign_keys = ON');
    connection.pragma('busy_timeout = 5000');
    migrate(drizzle(connection), {
      migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
    });
    console.info('Database migrations applied successfully.');
  } finally {
    connection.close();
  }
}

try {
  runMigrations();
} catch {
  console.error(
    'Database migration failed. Check configuration, migration files, and database access.',
  );
  process.exitCode = 1;
}
