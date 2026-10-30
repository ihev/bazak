import { apiErrorSchema } from '@bazak/contracts';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly requestId: string | null = null,
  ) {
    super(message);
  }
}

type RequestOptions = { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal };

function reportFailure(status: number, requestId: string | null, code: string): void {
  if (import.meta.env.DEV) console.warn('api.request_failed', { status, requestId, code });
}

export async function requestJson(path: string, options: RequestOptions = {}): Promise<unknown> {
  const timeout = AbortSignal.timeout(120_000);
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    reportFailure(0, null, 'NETWORK_UNAVAILABLE');
    throw new ApiRequestError(
      'Unable to reach the service. Please check your connection and retry.',
      0,
    );
  }
  const header = response.headers.get('X-Request-ID');
  const requestId = header && /^[0-9a-f-]{36}$/i.test(header) ? header : null;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    reportFailure(response.status, requestId, 'UNREADABLE_RESPONSE');
    throw new ApiRequestError(
      'The service returned an unreadable response. Please retry.',
      response.status,
      requestId,
    );
  }
  if (!response.ok) {
    const result = apiErrorSchema.safeParse(body);
    const code =
      result.success && /^[A-Z_]{1,80}$/.test(result.data.error.code)
        ? result.data.error.code
        : 'REQUEST_FAILED';
    reportFailure(response.status, requestId, code);
    throw new ApiRequestError(
      result.success ? result.data.error.message : 'The request failed. Please retry.',
      response.status,
      requestId,
    );
  }
  return body;
}
