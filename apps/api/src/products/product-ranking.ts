import type { CatalogProduct } from './catalog-product.js';
import type { SearchCriteria } from './search-criteria.js';

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function matchesProduct(product: CatalogProduct, criteria: SearchCriteria): boolean {
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

export function compareProducts(
  left: CatalogProduct,
  right: CatalogProduct,
  criteria: SearchCriteria,
): number {
  if (criteria.sort === 'price_asc') return left.price - right.price || left.id - right.id;
  if (criteria.sort === 'price_desc') return right.price - left.price || left.id - right.id;
  if (criteria.sort === 'rating_desc') return right.rating - left.rating || left.id - right.id;
  const query = normalize(criteria.query ?? '');
  const score = (product: CatalogProduct) =>
    query && normalize(product.title).includes(query) ? 1 : 0;
  return score(right) - score(left) || right.rating - left.rating || left.id - right.id;
}
