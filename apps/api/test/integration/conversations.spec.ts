import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { conversationSchema } from '@bazak/contracts';
import { createApp } from '../../dist/create-app.js';
import { ConversationTurnsRepository } from '../../dist/conversations/conversation-turns.repository.js';
import { createTestEnvironment } from '../support/test-environment.js';
import { UpstreamFixture } from '../support/upstream-fixture.js';

describe('conversation HTTP flow', () => {
  let environment: ReturnType<typeof createTestEnvironment>;
  let app: Awaited<ReturnType<typeof createApp>>;
  let upstream: UpstreamFixture;
  const server = () => app.getHttpServer() as Server;
  const create = async () => {
    const result = await request(server()).post('/api/conversations').expect(201);
    return conversationSchema.parse(result.body);
  };
  const send = (id: string, content = 'Find phones', requestId = randomUUID()) =>
    request(server()).post(`/api/conversations/${id}/messages`).send({ requestId, content });

  beforeEach(async () => {
    environment = createTestEnvironment();
    upstream = new UpstreamFixture();
    jest.spyOn(globalThis, 'fetch').mockImplementation(upstream.fetch);
    app = await createApp();
    await app.init();
  });

  afterEach(async () => {
    upstream.release();
    await app.close();
    jest.restoreAllMocks();
    environment.cleanup();
  });

  it('retrieves every page before filtering by budget and returns public product DTOs', async () => {
    const chat = await create();
    const response = await send(chat.id).expect(200);
    const result = conversationSchema.parse(response.body);
    const products = result.messages.at(-1)?.productGroups[0]?.products;
    expect(products?.map((product) => product.title)).toEqual([
      'Budget Phone',
      'Everyday Phone',
      'Travel Phone',
    ]);
    expect(products?.every((product) => product.price <= 500)).toBe(true);
    expect(upstream.catalogPages).toEqual([0, 100]);
    expect(response.body).not.toHaveProperty('searchState');
    expect(response.body.messages[0]).not.toHaveProperty('conversationId');
    expect(products?.[0]).not.toHaveProperty('brand');
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('continues an existing conversation with previous criteria and displayed prices', async () => {
    const chat = await create();
    await send(chat.id).expect(200);
    const response = await send(chat.id, 'Anything cheaper?').expect(200);
    expect(upstream.contexts[1]?.previousSearches[0]?.category).toBe('smartphones');
    expect(upstream.contexts[1]?.history.at(-1)?.products[0]?.price).toBe(99);
    expect(
      conversationSchema.parse(response.body).messages.at(-1)?.productGroups[0]?.products,
    ).toEqual([]);
    expect(conversationSchema.parse(response.body).messages).toHaveLength(4);
  });

  it.each([
    ['Something cheap and cool', 'What product type', 0],
    ['Book a flight to Tokyo', 'cannot book flights', 0],
    ['Find phones and fragrances', 'matching your search', 2],
    ['Find phones under $1', 'No products matched', 1],
  ])('handles %s without inventing products', async (content, text, groups) => {
    const chat = await create();
    const response = await send(chat.id, content).expect(200);
    const assistant = conversationSchema.parse(response.body).messages.at(-1);
    expect(assistant?.content).toContain(text);
    expect(assistant?.productGroups).toHaveLength(groups);
  });

  it('replays successful request IDs, rejects different content and avoids additional model calls', async () => {
    const chat = await create();
    const id = randomUUID();
    await send(chat.id, 'Find phones', id).expect(200);
    const replay = await send(chat.id, 'Find phones', id).expect(200);
    expect(replay.body.messages).toHaveLength(2);
    expect(upstream.contexts).toHaveLength(1);
    await send(chat.id, 'Changed content', id).expect(409);
  });

  it.each([
    ['timeout', 'LLM_TIMEOUT'],
    ['rate_limit', 'LLM_RATE_LIMIT'],
    ['invalid_json', 'LLM_INVALID_RESPONSE'],
    ['invalid_plan', 'LLM_INVALID_RESPONSE'],
    ['blocked', 'LLM_INVALID_RESPONSE'],
    ['output_limit', 'LLM_INVALID_RESPONSE'],
    ['catalog', 'CATALOG_UPSTREAM_HTTP'],
  ] as const)(
    'persists a retryable failure for %s and completes the same turn after recovery',
    async (failure, code) => {
      const chat = await create();
      const requestId = randomUUID();
      upstream.failure = failure;
      const failed = await send(chat.id, 'Find phones', requestId).expect(503);
      expect(failed.body.error.code).toBe(code);
      const stored = await request(server()).get(`/api/conversations/${chat.id}`).expect(200);
      expect(stored.body.messages).toHaveLength(1);
      expect(stored.body.messages[0].status).toBe('failed');
      upstream.failure = null;
      const retried = await send(chat.id, 'Find phones', requestId).expect(200);
      expect(retried.body.messages).toHaveLength(2);
    },
  );

  it('rejects another pending turn without blocking other conversations', async () => {
    const chat = await create();
    const other = await create();
    const first = send(chat.id, 'Slow phones').then((response) => response);
    for (let count = 0; upstream.contexts.length === 0 && count < 100; count++)
      await new Promise((resolve) => setTimeout(resolve, 5));
    await send(chat.id).expect(409);
    await send(other.id).expect(200);
    upstream.release();
    expect((await first).status).toBe(200);
  });

  it('rolls back an assistant-write failure and retries without duplicating the user message', async () => {
    const chat = await create();
    const id = randomUUID();
    environment.db.exec(
      "CREATE TRIGGER fail_reply BEFORE INSERT ON messages WHEN NEW.role = 'assistant' BEGIN SELECT RAISE(ABORT, 'Fixture failure'); END;",
    );
    await send(chat.id, 'Find phones', id).expect(503);
    environment.db.exec('DROP TRIGGER fail_reply;');
    const recovered = await send(chat.id, 'Find phones', id).expect(200);
    expect(recovered.body.messages).toHaveLength(2);
  });

  it('rejects retrying an older failed turn after a newer turn has completed', async () => {
    const chat = await create();
    const id = randomUUID();
    upstream.failure = 'timeout';
    await send(chat.id, 'Find phones', id).expect(503);
    upstream.failure = null;
    await send(chat.id, 'Find phones').expect(200);
    await send(chat.id, 'Find phones', id).expect(409);
    const stored = await request(server()).get(`/api/conversations/${chat.id}`).expect(200);
    expect(stored.body.messages).toHaveLength(3);
    expect(stored.body.messages[0].status).toBe('failed');
  });

  it('distinguishes an invalid catalog payload from a valid empty result', async () => {
    const chat = await create();
    const id = randomUUID();
    upstream.catalogOverride = { products: [{ id: 'invalid' }], total: 1 };
    const failed = await send(chat.id, 'Find phones', id).expect(503);
    expect(failed.body.error.code).toBe('CATALOG_INVALID_RESPONSE');
    upstream.catalogOverride = { products: [], total: 0 };
    const recovered = await send(chat.id, 'Find phones', id).expect(200);
    expect(recovered.body.messages).toHaveLength(2);
    expect(recovered.body.messages[1].content).toMatch(/^No products matched/);
  });

  it('restores cards after restart and makes interrupted turns retryable', async () => {
    const chat = await create();
    const result = await send(chat.id).expect(200);
    const interrupted = await create();
    const requestId = randomUUID();
    app
      .get(ConversationTurnsRepository)
      .beginTurn(interrupted.id, { requestId, content: 'Find phones' });
    await app.close();
    app = await createApp();
    await app.init();
    const restored = await request(server()).get(`/api/conversations/${chat.id}`).expect(200);
    expect(restored.body).toEqual(result.body);
    const pending = await request(server()).get(`/api/conversations/${interrupted.id}`).expect(200);
    expect(pending.body.messages[0].status).toBe('failed');
    await send(interrupted.id, 'Find phones', requestId).expect(200);
  });

  it('does not reset corrupt data, and returns 404 after a conversation is removed', async () => {
    const chat = await create();
    await send(chat.id).expect(200);
    environment.db
      .prepare(
        "UPDATE messages SET product_groups = 'broken' WHERE conversation_id = ? AND role = 'assistant'",
      )
      .run(chat.id);
    await request(server()).get(`/api/conversations/${chat.id}`).expect(503);
    expect(
      environment.db.prepare('SELECT id FROM conversations WHERE id = ?').get(chat.id),
    ).toBeDefined();
    environment.db.prepare('DELETE FROM conversations WHERE id = ?').run(chat.id);
    await request(server()).get(`/api/conversations/${chat.id}`).expect(404);
    await send(chat.id).expect(404);
  });

  it('validates input, logs malformed JSON with an ID, and lists independent conversations', async () => {
    const chat = await create();
    await create();
    await send(chat.id, ' ').expect(400);
    await send(chat.id, 'x'.repeat(2001)).expect(400);
    await send('not-a-uuid').expect(400);
    const malformed = await request(server())
      .post(`/api/conversations/${chat.id}/messages`)
      .set('Content-Type', 'application/json')
      .send('{broken')
      .expect(400);
    expect(malformed.headers['x-request-id']).toBeDefined();
    const list = await request(server()).get('/api/conversations').expect(200);
    expect(list.body).toHaveLength(2);
    expect(upstream.contexts).toHaveLength(0);
  });
});
