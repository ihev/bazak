import { ProductGroup, productSchema } from '@bazak/contracts';
import { Injectable } from '@nestjs/common';
import { DependencyUnavailableException } from '../common/http/dependency-unavailable.exception.js';
import { CatalogProduct } from './catalog-product.js';
import { DummyJsonClient } from './dummyjson.client.js';
import { SearchCriteria } from './search-criteria.js';

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

function matches(product: CatalogProduct, criteria: SearchCriteria): boolean {
  const searchable = normalize(
    [product.title, product.description, product.brand, ...product.tags].join(' '),
  );
  const tokens = normalize(criteria.query ?? '')
    .split(/\s+/)
    .filter(Boolean);
  return (
    (!criteria.category || tokens.every((token) => searchable.includes(token))) &&
    (!criteria.brand || normalize(product.brand ?? '').includes(normalize(criteria.brand))) &&
    (criteria.minPrice === null || product.price >= criteria.minPrice) &&
    (criteria.maxPrice === null || product.price <= criteria.maxPrice) &&
    (criteria.cheaperThan === null || product.price < criteria.cheaperThan)
  );
}

function compare(left: CatalogProduct, right: CatalogProduct, criteria: SearchCriteria): number {
  if (criteria.sort === 'price_asc') return left.price - right.price || left.id - right.id;
  if (criteria.sort === 'price_desc') return right.price - left.price || left.id - right.id;
  if (criteria.sort === 'rating_desc') return right.rating - left.rating || left.id - right.id;
  const query = normalize(criteria.query ?? '');
  const score = (product: CatalogProduct) =>
    query && normalize(product.title).includes(query) ? 1 : 0;
  return score(right) - score(left) || right.rating - left.rating || left.id - right.id;
}

@Injectable()
export class ProductSearchService {
  constructor(private readonly client: DummyJsonClient) {}

  async categories(): Promise<string[]> {
    try {
      return await this.client.categories();
    } catch (error) {
      if (error instanceof DependencyUnavailableException) throw error;
      throw new DependencyUnavailableException(
        'catalog',
        'The product catalog is unavailable. Please retry.',
        error,
      );
    }
  }

  async search(criteria: SearchCriteria): Promise<ProductGroup> {
    try {
      const candidates = await this.client.candidates(criteria);
      const matchesFound = candidates.products
        .filter((product) => matches(product, criteria))
        .sort((left, right) => compare(left, right, criteria));
      return {
        label: criteria.label,
        products: matchesFound.slice(0, 5).map((product) => productSchema.parse(product)),
        totalMatches: matchesFound.length,
        note: candidates.truncated
          ? 'The search was limited to up to 500 catalog candidates; results may be incomplete.'
          : null,
      };
    } catch (error) {
      if (error instanceof DependencyUnavailableException) throw error;
      throw new DependencyUnavailableException(
        'catalog',
        'The product catalog could not be searched. Please retry.',
        error,
      );
    }
  }
}
