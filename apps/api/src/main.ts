import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AppConfigService } from './config/app-config.service.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  const config = app.get(AppConfigService);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.webOrigin });
  app.enableShutdownHooks();
  await app.listen(config.port, config.host);
  Logger.log(`API listening on http://${config.host}:${config.port}/api`, 'Bootstrap');
}

void bootstrap().catch(() => {
  Logger.error(
    'API startup failed. Check environment configuration, database access, and port availability.',
    'Bootstrap',
  );
  process.exitCode = 1;
});
