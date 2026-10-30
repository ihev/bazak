import { Injectable } from '@nestjs/common';
import { resolve } from 'node:path';
import { loadEnvironment, workspaceRoot } from './environment.js';

@Injectable()
export class AppConfigService {
  private readonly environment = loadEnvironment();

  get host(): string {
    return this.environment.API_HOST;
  }

  get port(): number {
    return this.environment.API_PORT;
  }

  get webOrigin(): string {
    return this.environment.WEB_ORIGIN;
  }

  get databasePath(): string {
    return resolve(workspaceRoot, this.environment.DATABASE_PATH);
  }

  get llm() {
    const provider = this.environment.LLM_PROVIDER;
    const apiKey =
      provider === 'gemini' ? this.environment.GEMINI_API_KEY : this.environment.OPENAI_API_KEY;
    const model =
      provider === 'gemini' ? this.environment.GEMINI_MODEL : this.environment.OPENAI_MODEL;
    if (!apiKey.trim() || !model.trim()) {
      throw new Error(
        `Configure ${provider === 'gemini' ? 'GEMINI_API_KEY and GEMINI_MODEL' : 'OPENAI_API_KEY'} in the root .env file.`,
      );
    }
    return { provider, apiKey, model, timeoutMs: this.environment.LLM_TIMEOUT_MS };
  }
}
