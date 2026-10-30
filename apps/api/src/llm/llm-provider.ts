import type { DiscoveryPlan } from './discovery-plan.js';

export interface LlmProvider {
  plan(system: string, input: string): Promise<DiscoveryPlan>;
}
