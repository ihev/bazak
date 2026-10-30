import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { createApp } from './create-app.js';
import { AppConfigService } from './config/app-config.service.js';

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const config = app.get(AppConfigService);
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
