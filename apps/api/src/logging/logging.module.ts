import { Global, Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module.js';
import { AppLogger } from './app-logger.service.js';
import { RequestContext } from './request-context.service.js';

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [AppLogger, RequestContext],
  exports: [AppLogger, RequestContext],
})
export class LoggingModule {}
