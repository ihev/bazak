import { describe, expect, it, vi } from 'vitest';
import { ApiRequestError, requestJson } from '../src/lib/api-client';
import { request } from './fixtures';

describe('HTTP client failures', () => {
  it('preserves a structured error and a valid diagnostic request ID without logging message contents', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { code: 'LLM_TIMEOUT', message: 'Please retry.' } },
            { status: 503, headers: { 'X-Request-ID': request.requestId } },
          ),
        ),
    );
    await expect(requestJson('/conversations')).rejects.toMatchObject({
      message: 'Please retry.',
      status: 503,
      requestId: request.requestId,
    });
    expect(warn).toHaveBeenCalledWith('api.request_failed', {
      status: 503,
      requestId: request.requestId,
      code: 'LLM_TIMEOUT',
    });
  });

  it('turns unreadable responses and network failures into actionable errors', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('<html>Error</html>', { status: 502 }))
      .mockRejectedValueOnce(new TypeError('Synthetic connection failure'));
    vi.stubGlobal('fetch', fetch);
    await expect(requestJson('/conversations')).rejects.toMatchObject({
      status: 502,
      message: 'The service returned an unreadable response. Please retry.',
    });
    await expect(requestJson('/conversations')).rejects.toBeInstanceOf(ApiRequestError);
  });

  it('propagates cancellation without reporting it as an outage', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const controller = new AbortController();
    controller.abort();
    const error = new DOMException('Cancelled', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
    await expect(requestJson('/conversations', { signal: controller.signal })).rejects.toBe(error);
    expect(warn).not.toHaveBeenCalled();
  });
});
