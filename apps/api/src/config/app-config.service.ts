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
}
