import type { ProductGroup } from '@bazak/contracts';
import type { DiscoveryPlan } from '../llm/discovery-plan.js';

export function summarizeDiscovery(plan: DiscoveryPlan, groups: ProductGroup[]): string {
  if (plan.action !== 'search') return plan.text;
  const count = groups.reduce((sum, group) => sum + group.products.length, 0);
  const summary = count
    ? `Here ${count === 1 ? 'is 1 product' : `are ${count} products`} matching your search. You can refine the budget, brand, or product type.`
    : 'No products matched your criteria. Try a different budget, brand, or product type.';
  return plan.hasUnsupportedIntent
    ? `${summary}\n\nSome parts of your request are outside this product catalog. I searched the supported product types.`
    : summary;
}
