import { Injectable, LoggerService, OnApplicationShutdown } from '@nestjs/common';
import { mkdirSync } from 'node:fs';
import pino, { Logger as PinoLogger } from 'pino';
import { createStream, RotatingFileStream } from 'rotating-file-stream';
import { AppConfigService } from '../config/app-config.service.js';
import { RequestContext } from './request-context.service.js';
import { sanitizeLogFields, sanitizeLogText } from './log-sanitizer.js';

type Level = 'info' | 'error' | 'warn' | 'debug' | 'trace' | 'fatal';

@Injectable()
export class AppLogger implements LoggerService, OnApplicationShutdown {
  private readonly consoleLogger: PinoLogger;
  private logger: PinoLogger;
  private file: RotatingFileStream | undefined;

  constructor(
    config: AppConfigService,
    private readonly context: RequestContext,
  ) {
    const options = {
      level: config.logging.level,
      base: { service: 'api' },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (level: string) => ({ level }) },
    };
    this.consoleLogger = pino(options, process.stdout);
    this.logger = this.consoleLogger;
    if (!config.logging.toFile) return;
    try {
      mkdirSync(config.logging.directory, { recursive: true });
      this.file = createStream('api.log', {
        path: config.logging.directory,
        interval: '1d',
        size: '5M',
        maxFiles: 7,
        compress: 'gzip',
      });
      this.file.on('error', () => this.disableFileLogging());
      this.logger = pino(
        options,
        pino.multistream([
          { level: config.logging.level, stream: process.stdout },
          { level: config.logging.level, stream: this.file },
        ]),
      );
    } catch {
      this.disableFileLogging();
    }
  }

  log(message: unknown, ...params: unknown[]): void {
    this.write('info', message, params);
  }
  error(message: unknown, ...params: unknown[]): void {
    this.write('error', message, params);
  }
  warn(message: unknown, ...params: unknown[]): void {
    this.write('warn', message, params);
  }
  debug(message: unknown, ...params: unknown[]): void {
    this.write('debug', message, params);
  }
  verbose(message: unknown, ...params: unknown[]): void {
    this.write('trace', message, params);
  }
  fatal(message: unknown, ...params: unknown[]): void {
    this.write('fatal', message, params);
  }

  async onApplicationShutdown(): Promise<void> {
    this.logger = this.consoleLogger;
    if (this.file && !this.file.destroyed) {
      await new Promise<void>((resolve) => {
        this.file?.end(resolve);
      });
    }
  }

  private write(level: Level, message: unknown, params: unknown[]): void {
    const context = params.at(-1);
    const fields = {
      ...this.context.getBindings(),
      ...(typeof context === 'string' && /^[\w.-]{1,80}$/.test(context) ? { context } : {}),
      ...sanitizeLogFields(message),
    };
    const text =
      typeof message === 'string'
        ? sanitizeLogText(message)
        : message instanceof Error
          ? 'Unexpected application error.'
          : 'Application event';
    this.logger[level](fields, text);
  }

  private disableFileLogging(): void {
    this.logger = this.consoleLogger;
    this.consoleLogger.error(
      { event: 'logging.file_unavailable' },
      'File logging unavailable; console logging continues.',
    );
  }
}
