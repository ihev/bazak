import { z } from 'zod';
import { searchCriteriaSchema, SearchCriteria } from '../products/search-criteria.js';

export const discoveryPlanSchema = z.object({
  action: z.enum(['search', 'clarify', 'respond', 'unsupported']),
  text: z.string().min(1).max(600),
  hasUnsupportedIntent: z.boolean(),
  searches: z.array(searchCriteriaSchema).max(3),
});

export type DiscoveryPlan = z.infer<typeof discoveryPlanSchema>;

export interface DiscoveryContext {
  message: string;
  categories: string[];
  previousSearches: SearchCriteria[];
  history: {
    role: 'user' | 'assistant';
    content: string;
    products: { id: number; title: string; price: number }[];
  }[];
}
