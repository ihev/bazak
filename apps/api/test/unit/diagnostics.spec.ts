import { afterEach, describe, expect, it } from '@jest/globals';
import { z } from 'zod';
import { describeFailure } from '../../dist/common/http/dependency-unavailable.exception.js';
import { sanitizeLogFields, sanitizeLogText } from '../../dist/logging/log-sanitizer.js';

describe('safe diagnostics', () => {
  const previousKey = process.env.GEMINI_API_KEY;
  afterEach(() => {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  });

  it.each([
    [{ cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } }, { reason: 'timeout' }],
    [{ status: 429 }, { reason: 'rate_limit', upstreamStatus: 429 }],
    [{ status: 403 }, { reason: 'upstream_http', upstreamStatus: 403 }],
    [{ cause: { code: 'SQLITE_FULL' } }, { reason: 'storage_error', storageCode: 'SQLITE_FULL' }],
    [{ cause: { code: 'ECONNRESET' } }, { reason: 'network_error' }],
    [new SyntaxError('Private provider response'), { reason: 'invalid_response' }],
  ])('classifies dependency failures without exposing raw messages', (error, expected) => {
    expect(describeFailure(error)).toEqual(expected);
  });

  it('reports only schema paths for invalid responses and stops on cyclic causes', () => {
    const result = z.object({ privateInput: z.number() }).safeParse({ privateInput: 'sensitive' });
    if (result.success) throw new Error('Expected invalid fixture.');
    expect(describeFailure(result.error)).toEqual({
      reason: 'invalid_response',
      fields: ['privateInput'],
    });
    const cyclic: { cause?: unknown } = {};
    cyclic.cause = cyclic;
    expect(describeFailure(cyclic)).toEqual({ reason: 'unexpected_error' });
  });

  it('drops sensitive and nested fields, scrubs configured credentials and bounds log payloads', () => {
    process.env.GEMINI_API_KEY = 'synthetic-secret-for-unit-test';
    const safe = sanitizeLogFields({
      event: 'llm.failed',
      requestId: 'abc',
      durationMs: Infinity,
      prompt: 'private conversation',
      headers: { authorization: 'private' },
      reason: 'synthetic-secret-for-unit-test',
      fields: ['safe', { secret: 'private' }],
      code: { raw: 'private' },
    });
    expect(safe).toEqual({
      event: 'llm.failed',
      requestId: 'abc',
      reason: '[REDACTED]',
      fields: ['safe'],
    });
    expect(sanitizeLogText('x'.repeat(2000))).toHaveLength(1000);
    expect(sanitizeLogFields(new Error('private'))).toEqual({});
  });
});
