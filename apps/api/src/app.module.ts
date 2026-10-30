import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ChatModule } from './chat/chat.module.js';
import { ApiExceptionFilter } from './common/http/api-exception.filter.js';
import { AppConfigModule } from './config/app-config.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [AppConfigModule, HealthModule, ChatModule],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
