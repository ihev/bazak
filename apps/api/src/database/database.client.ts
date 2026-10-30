import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { AppConfigService } from '../config/app-config.service.js';
import * as schema from './schema.js';

@Injectable()
export class DatabaseClient implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseClient.name);
  private readonly connection: Database.Database;
  readonly db;

  constructor(config: AppConfigService) {
    mkdirSync(dirname(config.databasePath), { recursive: true });
    this.connection = new Database(config.databasePath);
    this.connection.pragma('foreign_keys = ON');
    this.connection.pragma('busy_timeout = 5000');
    this.connection.pragma('journal_mode = WAL');
    this.db = drizzle(this.connection, { schema });
    this.logger.log({ event: 'database.connected' });
  }

  onApplicationShutdown(): void {
    this.connection.close();
    this.logger.log({ event: 'database.closed' });
  }
}
