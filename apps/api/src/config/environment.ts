import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { z } from 'zod';

export const workspaceRoot = fileURLToPath(new URL('../../../../', import.meta.url));

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.enum(['127.0.0.1', 'localhost']).default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  DATABASE_PATH: z.string().trim().min(1).default('.data/bazak.sqlite'),
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(): Environment {
  config({ path: resolve(workspaceRoot, '.env'), quiet: true });
  const result = environmentSchema.safeParse(process.env);

  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid environment configuration. Check: ${fields}.`);
  }

  return result.data;
}
