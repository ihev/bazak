import { describe, expect, it } from '@jest/globals';
import { compareProducts, matchesProduct } from '../../dist/products/product-ranking.js';
import { catalogProductSchema, toCatalogProduct } from '../../dist/products/catalog-product.js';
import { phoneSearch } from '../support/upstream-fixture.js';
import type { CatalogProduct } from '../../dist/products/catalog-product.js';

const product: CatalogProduct = {
  id: 1,
  title: 'Café Phone',
  description: 'Compact everyday phone',
  price: 100,
  image: null,
  category: 'smartphones',
  brand: 'Example',
  rating: 4.5,
  tags: ['wireless'],
};

describe('catalog filtering and ranking', () => {
  it('includes both budget boundaries but makes cheaper-than exclusive', () => {
    const criteria = { ...phoneSearch, minPrice: 100, maxPrice: 200 };
    expect(matchesProduct(product, criteria)).toBe(true);
    expect(matchesProduct({ ...product, price: 200 }, criteria)).toBe(true);
    expect(matchesProduct({ ...product, price: 99.99 }, criteria)).toBe(false);
    expect(matchesProduct({ ...product, price: 200.01 }, criteria)).toBe(false);
    expect(matchesProduct(product, { ...criteria, cheaperThan: 100 })).toBe(false);
    expect(matchesProduct(product, { ...criteria, cheaperThan: 100.01 })).toBe(true);
  });

  it('combines category query tokens, normalized brands and the budget', () => {
    const criteria = { ...phoneSearch, query: 'CAFE wireless', brand: 'EXAMPLE' };
    expect(matchesProduct(product, criteria)).toBe(true);
    expect(matchesProduct(product, { ...criteria, query: 'cafe waterproof' })).toBe(false);
    expect(matchesProduct({ ...product, brand: null }, criteria)).toBe(false);
    expect(matchesProduct(product, { ...criteria, maxPrice: 99 })).toBe(false);
  });

  it('trusts catalog keyword matching when no category is selected', () => {
    expect(matchesProduct(product, { ...phoneSearch, category: null, query: 'mobile' })).toBe(true);
    expect(
      matchesProduct(product, { ...phoneSearch, category: null, query: 'mobile', brand: 'Other' }),
    ).toBe(false);
  });

  it.each([
    ['price_asc', [2, 1, 3]],
    ['price_desc', [3, 1, 2]],
    ['rating_desc', [2, 3, 1]],
    ['relevance', [1, 2, 3]],
  ] as const)('orders %s deterministically, including ties', (sort, ids) => {
    const products = [
      { ...product, id: 3, title: 'Travel mobile', price: 200, rating: 5 },
      { ...product, id: 1, price: 100, rating: 4 },
      { ...product, id: 2, title: 'Budget mobile', price: 50, rating: 5 },
    ];
    expect(
      products
        .sort((a, b) => compareProducts(a, b, { ...phoneSearch, sort, query: 'cafe' }))
        .map((item) => item.id),
    ).toEqual(ids);
  });

  it('falls back from an unsafe thumbnail to a valid image and tolerates missing images', () => {
    const raw = catalogProductSchema.parse({
      ...product,
      thumbnail: 'javascript:alert(1)',
      images: ['data:image/png,unsafe', 'https://example.test/safe.jpg'],
    });
    expect(toCatalogProduct(raw).image).toBe('https://example.test/safe.jpg');
    expect(toCatalogProduct({ ...raw, images: [] }).image).toBeNull();
  });
});
