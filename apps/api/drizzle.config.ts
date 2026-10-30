import { defineConfig } from 'drizzle-kit';
import { resolve } from 'node:path';
import { loadEnvironment, workspaceRoot } from './src/config/environment.js';

const environment = loadEnvironment();

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/database/schema.ts',
  out: './drizzle',
  dbCredentials: { url: resolve(workspaceRoot, environment.DATABASE_PATH) },
  strict: true,
});
