import type { DiscoveryContext, DiscoveryPlan } from '../../dist/llm/discovery-plan.js';
import type { SearchCriteria } from '../../dist/products/search-criteria.js';

export const phoneSearch: SearchCriteria = {
  label: 'Phones',
  category: 'smartphones',
  query: null,
  brand: null,
  minPrice: null,
  maxPrice: 500,
  cheaperThan: null,
  sort: 'price_asc',
};

const phone = (id: number, title: string, price: number) => ({
  id,
  title,
  description: `A useful ${title.toLowerCase()} for everyday use.`,
  price,
  category: 'smartphones',
  brand: 'Example',
  rating: 4.5,
  tags: ['phone'],
  thumbnail: 'https://images.example.test/product.svg',
  images: [],
});

export const catalogProducts = [
  ...Array.from({ length: 101 }, (_, index) => phone(index + 1, `Premium phone ${index + 1}`, 900)),
  phone(102, 'Budget Phone', 99),
  phone(103, 'Everyday Phone', 199),
  phone(104, 'Travel Phone', 299),
  { ...phone(105, 'Everyday Fragrance', 25), category: 'fragrances', tags: ['fragrance'] },
];

type Failure =
  | 'timeout'
  | 'rate_limit'
  | 'catalog'
  | 'invalid_json'
  | 'invalid_plan'
  | 'blocked'
  | 'output_limit';

export class UpstreamFixture {
  readonly contexts: DiscoveryContext[] = [];
  readonly catalogPages: number[] = [];
  failure: Failure | null = null;
  catalogOverride: unknown = undefined;
  private readonly attempts = new Map<string, number>();
  private releasePlan: (() => void) | undefined;

  release(): void {
    this.releasePlan?.();
  }

  fetch: typeof fetch = async (input, init) => {
    const url = new URL(
      typeof input === 'string' || input instanceof URL ? String(input) : input.url,
    );
    if (url.hostname === 'dummyjson.com') return this.catalog(url);
    if (url.hostname !== 'generativelanguage.googleapis.com')
      throw new Error('Unexpected external request blocked by test fixture.');
    if (this.failure === 'timeout')
      throw Object.assign(new Error('Synthetic timeout'), { name: 'AbortError' });
    if (this.failure === 'rate_limit')
      return Response.json(
        { error: { code: 429, message: 'Fixture rate limit', status: 'RESOURCE_EXHAUSTED' } },
        { status: 429 },
      );
    const body = JSON.parse(String(init?.body)) as { contents: { parts: { text: string }[] }[] };
    const text = body.contents[0]?.parts[0]?.text;
    if (!text) throw new Error('Expected the SDK to send structured planning input.');
    const context = JSON.parse(text) as DiscoveryContext;
    this.contexts.push(context);
    const count = (this.attempts.get(context.message) ?? 0) + 1;
    this.attempts.set(context.message, count);
    if (context.message === 'Retry phones' && count === 1)
      throw Object.assign(new Error('Synthetic timeout'), { name: 'AbortError' });
    if (context.message === 'Slow phones')
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 1200);
        this.releasePlan = () => {
          clearTimeout(timer);
          resolve();
        };
      });
    const plan = this.plan(context);
    const output = this.failure === 'invalid_json' ? '{broken' : JSON.stringify(plan);
    const finishReason =
      this.failure === 'blocked'
        ? 'SAFETY'
        : this.failure === 'output_limit'
          ? 'MAX_TOKENS'
          : 'STOP';
    return Response.json({
      candidates: [{ content: { role: 'model', parts: [{ text: output }] }, finishReason }],
    });
  };

  private plan(context: DiscoveryContext): DiscoveryPlan {
    const message = context.message.toLowerCase();
    if (message.includes('cheap and cool'))
      return {
        action: 'clarify',
        text: 'What product type are you looking for?',
        hasUnsupportedIntent: false,
        searches: [],
      };
    if (message.includes('flight'))
      return {
        action: 'unsupported',
        text: 'I can help with catalog products, but cannot book flights.',
        hasUnsupportedIntent: false,
        searches: [],
      };
    let search = { ...phoneSearch };
    if (message.includes('cheaper'))
      search = { ...(context.previousSearches[0] ?? phoneSearch), cheaperThan: 99 };
    if (message.includes('under $1')) search.maxPrice = 1;
    if (this.failure === 'invalid_plan') search.category = 'invented-category';
    return {
      action: 'search',
      text: 'Search the catalog.',
      hasUnsupportedIntent: false,
      searches: message.includes('and fragrances')
        ? [search, { ...phoneSearch, label: 'Fragrances', category: 'fragrances', maxPrice: 30 }]
        : [search],
    };
  }

  private catalog(url: URL): Response {
    if (this.failure === 'catalog')
      return Response.json({ message: 'Fixture outage' }, { status: 503 });
    if (url.pathname.endsWith('category-list')) return Response.json(['smartphones', 'fragrances']);
    if (this.catalogOverride !== undefined) return Response.json(this.catalogOverride);
    const category = url.pathname.split('/category/')[1];
    const query = url.searchParams.get('q')?.toLowerCase();
    const matches = catalogProducts.filter((product) =>
      category
        ? product.category === category
        : !query || product.title.toLowerCase().includes(query),
    );
    const skip = Number(url.searchParams.get('skip') ?? 0);
    this.catalogPages.push(skip);
    const limit = Number(url.searchParams.get('limit') ?? 30);
    return Response.json({
      products: matches.slice(skip, skip + limit),
      total: matches.length,
      skip,
      limit,
    });
  }
}
