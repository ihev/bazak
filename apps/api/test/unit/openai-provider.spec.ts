import { afterEach, expect, it, jest } from '@jest/globals';
import { OpenAiProvider } from '../../dist/llm/providers/openai.provider.js';

afterEach(() => {
  jest.restoreAllMocks();
});

it('uses structured Responses output without storage and parses the SDK response', async () => {
  const plan = {
    action: 'clarify',
    text: 'What product type?',
    hasUnsupportedIntent: false,
    searches: [],
  };
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({
      id: 'resp_fixture',
      object: 'response',
      status: 'completed',
      output: [
        {
          id: 'msg_fixture',
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: JSON.stringify(plan), annotations: [] }],
        },
      ],
    }),
  );
  const provider = new OpenAiProvider('synthetic-key', 'gpt-5.4-mini', 1000);
  await expect(provider.plan('System instruction', 'Synthetic input')).resolves.toEqual(plan);
  expect(fetch).toHaveBeenCalledTimes(1);
  const [input, init] = fetch.mock.calls[0]!;
  expect(String(input)).toBe('https://api.openai.com/v1/responses');
  const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
  expect(body).toMatchObject({
    model: 'gpt-5.4-mini',
    store: false,
    text: { format: { type: 'json_schema', strict: true } },
  });
});

it('does not retry a rejected provider request or return it as a successful plan', async () => {
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      Response.json(
        { error: { message: 'Synthetic refusal', type: 'invalid_request_error' } },
        { status: 401 },
      ),
    );
  const provider = new OpenAiProvider('synthetic-key', 'gpt-5.4-mini', 1000);
  await expect(provider.plan('Instruction', 'Synthetic input')).rejects.toMatchObject({
    status: 401,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});
