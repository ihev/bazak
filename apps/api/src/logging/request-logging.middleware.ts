import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { RequestContext } from './request-context.service.js';

export function requestLogging(context: RequestContext) {
  const logger = new Logger('HTTP');
  return (request: Request, response: Response, next: NextFunction): void => {
    const requestId = randomUUID();
    const start = performance.now();
    response.setHeader('X-Request-ID', requestId);
    context.run(requestId, () => {
      logger.debug({ event: 'http.started', method: request.method });
      response.once('close', () => {
        const route: unknown = (request.route as { path?: unknown } | undefined)?.path;
        const fields = {
          event: response.writableFinished ? 'http.completed' : 'http.disconnected',
          requestId,
          method: request.method,
          route:
            typeof route === 'string' && /^[\w/{}:*.-]{1,200}$/.test(route) ? route : 'unmatched',
          status: response.statusCode,
          durationMs: Math.round(performance.now() - start),
        };
        if (!response.writableFinished || response.statusCode >= 400) logger.warn(fields);
        else logger.log(fields);
      });
      next();
    });
  };
}
