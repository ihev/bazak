import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { DummyJsonClient } from '../../dist/products/dummyjson.client.js';
import { catalogProducts, phoneSearch } from '../support/upstream-fixture.js';

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('caps traversal at 500 candidates and explicitly marks incomplete results', async () => {
  const fetch = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const skip = Number(new URL(String(input)).searchParams.get('skip'));
    return Response.json({
      total: 600,
      products: Array.from({ length: 100 }, (_, index) => ({
        ...catalogProducts[0],
        id: skip + index + 1,
      })),
    });
  });
  const result = await new DummyJsonClient().candidates(phoneSearch);
  expect(result.products).toHaveLength(500);
  expect(result.truncated).toBe(true);
  expect(
    fetch.mock.calls.map(([input]) => new URL(String(input)).searchParams.get('skip')),
  ).toEqual(['0', '100', '200', '300', '400']);
});

it('stops when an upstream repeats a page instead of looping or duplicating cards', async () => {
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () =>
      Response.json({ total: 600, products: catalogProducts.slice(0, 100) }),
    );
  const result = await new DummyJsonClient().candidates(phoneSearch);
  expect(result.products).toHaveLength(100);
  expect(result.truncated).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(2);
});
