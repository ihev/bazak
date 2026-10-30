import { ApiErrorResponse } from '@bazak/contracts';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { DependencyUnavailableException } from './dependency-unavailable.exception.js';

const errorCodes: Record<number, string> = {
  400: 'INVALID_REQUEST',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'TOO_MANY_REQUESTS',
  503: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const message =
      exception instanceof HttpException && (status < 500 || status === 503)
        ? exception.message
        : status === 503
          ? 'Service unavailable. Please try again later.'
          : 'An unexpected error occurred.';

    if (status >= 500) {
      this.logger.error(
        JSON.stringify({
          event: 'request_failed',
          httpStatus: status,
          ...(exception instanceof DependencyUnavailableException
            ? { dependency: exception.dependency, code: exception.code, ...exception.details }
            : { code: errorCodes[status] ?? 'INTERNAL_ERROR' }),
        }),
      );
    }

    const body: ApiErrorResponse = {
      error: {
        code:
          exception instanceof DependencyUnavailableException
            ? exception.code
            : (errorCodes[status] ?? (status < 500 ? 'INVALID_REQUEST' : 'INTERNAL_ERROR')),
        message,
      },
    };
    response.status(status).json(body);
  }
}
