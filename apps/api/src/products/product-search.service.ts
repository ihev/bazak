import { ProductGroup, productSchema } from '@bazak/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { DependencyUnavailableException } from '../common/http/dependency-unavailable.exception.js';
import { matchesProduct, compareProducts } from './product-ranking.js';
import { DummyJsonClient } from './dummyjson.client.js';
import { SearchCriteria } from './search-criteria.js';

@Injectable()
export class ProductSearchService {
  private readonly logger = new Logger(ProductSearchService.name);
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
    const start = performance.now();
    this.logger.log({
      event: 'search.started',
      resource: criteria.category ? 'category' : 'keyword',
    });
    try {
      const candidates = await this.client.candidates(criteria);
      const matchesFound = candidates.products
        .filter((product) => matchesProduct(product, criteria))
        .sort((left, right) => compareProducts(left, right, criteria));
      this.logger.log({
        event: 'search.completed',
        durationMs: Math.round(performance.now() - start),
        candidates: candidates.products.length,
        count: matchesFound.length,
        products: Math.min(matchesFound.length, 5),
        truncated: candidates.truncated,
      });
      return {
        label: criteria.label,
        products: matchesFound.slice(0, 5).map((product) => productSchema.parse(product)),
        totalMatches: matchesFound.length,
        note: candidates.truncated
          ? 'The search was limited to up to 500 catalog candidates; results may be incomplete.'
          : null,
      };
    } catch (error) {
      this.logger.warn({
        event: 'search.failed',
        durationMs: Math.round(performance.now() - start),
      });
      if (error instanceof DependencyUnavailableException) throw error;
      throw new DependencyUnavailableException(
        'catalog',
        'The product catalog could not be searched. Please retry.',
        error,
      );
    }
  }
}
