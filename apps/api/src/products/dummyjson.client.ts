import { Injectable } from '@nestjs/common';
import { DependencyUnavailableException } from '../common/http/dependency-unavailable.exception.js';
import { z } from 'zod';
import { catalogProductSchema, toCatalogProduct } from './catalog-product.js';
import { SearchCriteria } from './search-criteria.js';

const pageSchema = z.object({
  products: z.array(catalogProductSchema),
  total: z.number().int().nonnegative(),
});

@Injectable()
export class DummyJsonClient {
  private categoryCache: { values: string[]; expiresAt: number } | null = null;

  async categories(): Promise<string[]> {
    if (this.categoryCache && this.categoryCache.expiresAt > Date.now())
      return this.categoryCache.values;
    const values = z.array(z.string().min(1)).parse(await this.request('/products/category-list'));
    this.categoryCache = { values, expiresAt: Date.now() + 300_000 };
    return values;
  }

  async candidates(criteria: SearchCriteria) {
    const path = criteria.category
      ? `/products/category/${encodeURIComponent(criteria.category)}`
      : '/products/search';
    const products = new Map<number, ReturnType<typeof toCatalogProduct>>();
    let skip = 0;
    let total = Infinity;
    while (skip < total && skip < 500) {
      const query = new URLSearchParams({ limit: '100', skip: String(skip) });
      if (!criteria.category) query.set('q', criteria.query ?? '');
      const page = pageSchema.parse(await this.request(`${path}?${query}`));
      total = page.total;
      const previousCount = products.size;
      for (const product of page.products.slice(0, 500 - skip))
        products.set(product.id, toCatalogProduct(product));
      skip += page.products.length;
      if (!page.products.length || products.size === previousCount) break;
    }
    return { products: [...products.values()], truncated: products.size < total };
  }

  private async request(path: string): Promise<unknown> {
    try {
      const response = await fetch(`https://dummyjson.com${path}`, {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: 'application/json' },
      });
      if (!response.ok)
        throw new DependencyUnavailableException(
          'catalog',
          'The product catalog is unavailable. Please retry.',
          undefined,
          { reason: 'upstream_http', upstreamStatus: response.status },
        );
      return await response.json();
    } catch (error) {
      if (error instanceof DependencyUnavailableException) throw error;
      throw new DependencyUnavailableException(
        'catalog',
        'The product catalog is unavailable. Please retry.',
        error,
      );
    }
  }
}
