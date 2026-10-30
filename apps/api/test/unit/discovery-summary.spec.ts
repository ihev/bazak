import { expect, it } from '@jest/globals';
import { summarizeDiscovery } from '../../dist/chat/discovery-summary.js';
import type { DiscoveryPlan } from '../../dist/llm/discovery-plan.js';
import { phoneSearch } from '../support/upstream-fixture.js';

it('builds search wording from actual cards rather than untrusted model claims', () => {
  const plan: DiscoveryPlan = {
    action: 'search',
    text: 'Guaranteed five free phones!',
    hasUnsupportedIntent: false,
    searches: [phoneSearch],
  };
  expect(summarizeDiscovery(plan, [])).toMatch(/^No products matched/);
  const product = { id: 1, title: 'Phone', description: '', price: 99, image: null };
  const group = { label: 'Phones', products: [product], totalMatches: 40, note: null };
  expect(summarizeDiscovery(plan, [group])).toMatch(/^Here is 1 product matching/);
  expect(
    summarizeDiscovery(plan, [{ ...group, products: [product, { ...product, id: 2 }] }]),
  ).toMatch(/^Here are 2 products matching/);
  expect(summarizeDiscovery({ ...plan, hasUnsupportedIntent: true }, [])).toContain(
    'outside this product catalog',
  );
  expect(
    summarizeDiscovery(
      { ...plan, action: 'clarify', searches: [], text: 'What product type?' },
      [],
    ),
  ).toBe('What product type?');
});
