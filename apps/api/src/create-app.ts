import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AppConfigService } from './config/app-config.service.js';
import { AppLogger } from './logging/app-logger.service.js';
import { RequestContext } from './logging/request-context.service.js';
import { requestLogging } from './logging/request-logging.middleware.js';

export async function createApp() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(AppLogger));
  const config = app.get(AppConfigService);
  app.use(requestLogging(app.get(RequestContext)));
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.webOrigin, exposedHeaders: ['X-Request-ID'] });
  app.enableShutdownHooks();
  return app;
}
