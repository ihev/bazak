import { ApiErrorResponse } from '@bazak/contracts';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';

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
      exception instanceof HttpException && status < 500
        ? exception.message
        : status === 503
          ? 'Service unavailable. Please try again later.'
          : 'An unexpected error occurred.';

    if (status >= 500) {
      this.logger.error(`Request failed with HTTP ${status}.`);
    }

    const body: ApiErrorResponse = {
      error: { code: errorCodes[status] ?? 'INTERNAL_ERROR', message },
    };
    response.status(status).json(body);
  }
}
