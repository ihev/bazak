import type { Product } from '@bazak/contracts';
import { z } from 'zod';

export const catalogProductSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string(),
  price: z.number().nonnegative(),
  category: z.string(),
  brand: z.string().nullish(),
  rating: z.number().default(0),
  tags: z.array(z.string()).default([]),
  thumbnail: z.string().nullish(),
  images: z.array(z.string()).default([]),
});

export type CatalogProduct = Product & {
  category: string;
  brand: string | null;
  rating: number;
  tags: string[];
};

function safeImage(value: string | undefined | null): string | null {
  return value && z.url({ protocol: /^https?$/ }).safeParse(value).success ? value : null;
}

export function toCatalogProduct(raw: z.infer<typeof catalogProductSchema>): CatalogProduct {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    price: raw.price,
    image: safeImage(raw.thumbnail) ?? raw.images.map(safeImage).find(Boolean) ?? null,
    category: raw.category,
    brand: raw.brand ?? null,
    rating: raw.rating,
    tags: raw.tags,
  };
}
