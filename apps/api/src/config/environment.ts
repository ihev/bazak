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
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
  LOG_TO_FILE: z.enum(['true', 'false']).default('true'),
  LOG_DIRECTORY: z.string().trim().min(1).default('.data/logs'),
  LLM_PROVIDER: z.enum(['gemini', 'openai']).default('openai'),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(60_000),
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default(''),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.enum(['gpt-5.4-mini', 'gpt-5.4-nano']).default('gpt-5.4-mini'),
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
