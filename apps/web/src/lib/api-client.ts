import { apiErrorSchema } from '@bazak/contracts';

export async function getJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`/api${path}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  const body: unknown = await response.json();

  if (!response.ok) {
    const result = apiErrorSchema.safeParse(body);
    throw new Error(result.success ? result.data.error.message : 'The request failed.');
  }

  return body;
}
