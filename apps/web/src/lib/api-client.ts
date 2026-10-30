import { apiErrorSchema } from '@bazak/contracts';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type RequestOptions = { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal };

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
  } catch {
    throw new ApiRequestError(
      'Unable to reach the service. Please check your connection and retry.',
      0,
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiRequestError(
      'The service returned an unreadable response. Please retry.',
      response.status,
    );
  }
  if (!response.ok) {
    const result = apiErrorSchema.safeParse(body);
    throw new ApiRequestError(
      result.success ? result.data.error.message : 'The request failed. Please retry.',
      response.status,
    );
  }
  return body;
}
