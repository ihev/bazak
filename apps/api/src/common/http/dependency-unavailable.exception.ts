import { ServiceUnavailableException } from '@nestjs/common';
import { ZodError } from 'zod';

type Dependency = 'llm' | 'catalog' | 'storage';

export interface FailureDetails {
  reason:
    | 'timeout'
    | 'rate_limit'
    | 'upstream_http'
    | 'invalid_response'
    | 'storage_error'
    | 'network_error'
    | 'unexpected_error';
  upstreamStatus?: number;
  storageCode?: string;
  fields?: string[];
}

const timeoutNames = new Set([
  'AbortError',
  'TimeoutError',
  'RequestTimeoutError',
  'APIConnectionTimeoutError',
]);
const networkCodes = new Set(['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']);
const timeoutCodes = new Set(['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT']);

export function describeFailure(error: unknown): FailureDetails {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    if (current instanceof ZodError) {
      return {
        reason: 'invalid_response',
        fields: current.issues.slice(0, 5).map((issue) => issue.path.join('.')),
      };
    }
    if (current instanceof SyntaxError) return { reason: 'invalid_response' };
    const record = current as Record<string, unknown>;
    if (typeof record.name === 'string' && timeoutNames.has(record.name))
      return { reason: 'timeout' };
    if (typeof record.code === 'string') {
      if (timeoutCodes.has(record.code)) return { reason: 'timeout' };
      if (networkCodes.has(record.code)) return { reason: 'network_error' };
      if (/^SQLITE_[A-Z_]+$/.test(record.code))
        return { reason: 'storage_error', storageCode: record.code };
    }
    if (
      typeof record.status === 'number' &&
      Number.isInteger(record.status) &&
      record.status >= 400 &&
      record.status <= 599
    ) {
      return {
        reason:
          record.status === 429
            ? 'rate_limit'
            : record.status === 408 || record.status === 504
              ? 'timeout'
              : 'upstream_http',
        upstreamStatus: record.status,
      };
    }
    current = record.cause;
  }
  return { reason: 'unexpected_error' };
}

export class DependencyUnavailableException extends ServiceUnavailableException {
  readonly code: string;

  constructor(
    readonly dependency: Dependency,
    message: string,
    cause: unknown,
    readonly details: FailureDetails = describeFailure(cause),
  ) {
    super(message, { cause });
    this.code = `${dependency.toUpperCase()}_${details.reason.toUpperCase()}`;
  }
}
