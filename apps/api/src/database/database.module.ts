import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module.js';
import { DatabaseClient } from './database.client.js';
import { DatabaseHealthRepository } from './database-health.repository.js';

@Module({
  imports: [AppConfigModule],
  providers: [DatabaseClient, DatabaseHealthRepository],
  exports: [DatabaseClient, DatabaseHealthRepository],
})
export class DatabaseModule {}
