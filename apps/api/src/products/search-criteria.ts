import { z } from 'zod';

export const searchCriteriaSchema = z.object({
  label: z.string().min(1).max(80),
  category: z.string().nullable(),
  query: z.string().max(100).nullable(),
  brand: z.string().max(100).nullable(),
  minPrice: z.number().nonnegative().nullable(),
  maxPrice: z.number().nonnegative().nullable(),
  cheaperThan: z.number().nonnegative().nullable(),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'rating_desc']),
});

export type SearchCriteria = z.infer<typeof searchCriteriaSchema>;
