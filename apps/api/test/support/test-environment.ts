import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fileURLToPath } from 'node:url';

export function createTestEnvironment() {
  const directory = mkdtempSync(resolve(tmpdir(), 'bazak-test-'));
  const databasePath = resolve(directory, 'test.sqlite');
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_PATH: databasePath,
    LLM_PROVIDER: 'gemini',
    GEMINI_API_KEY: 'test-key-never-sent-to-real-provider',
    GEMINI_MODEL: 'fixture-model',
    OPENAI_API_KEY: 'test-key-never-sent-to-real-provider',
    OPENAI_MODEL: 'gpt-5.4-mini',
    LLM_TIMEOUT_MS: '1000',
    LOG_LEVEL: 'silent',
    LOG_TO_FILE: 'false',
    LOG_DIRECTORY: resolve(directory, 'logs'),
    API_HOST: '127.0.0.1',
  });
  const db = new Database(databasePath);
  db.pragma('foreign_keys = ON');
  migrate(drizzle(db), {
    migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)),
  });
  return {
    db,
    directory,
    cleanup() {
      db.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
