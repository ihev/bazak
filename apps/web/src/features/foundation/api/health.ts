import { healthResponseSchema } from '@bazak/contracts';
import { getJson } from '../../../lib/api-client';

export async function getHealth(signal: AbortSignal) {
  return healthResponseSchema.parse(await getJson('/health', signal));
}
