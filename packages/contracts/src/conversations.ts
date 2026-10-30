import { z } from 'zod';

export const productSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string(),
  price: z.number().nonnegative(),
  image: z.url({ protocol: /^https?$/ }).nullable(),
});

export const productGroupSchema = z.object({
  label: z.string(),
  products: z.array(productSchema).max(5),
  totalMatches: z.number().int().nonnegative(),
  note: z.string().nullable(),
});

export const messageSchema = z.object({
  id: z.uuid(),
  role: z.enum(['user', 'assistant']),
  status: z.enum(['pending', 'completed', 'failed']),
  content: z.string(),
  requestId: z.uuid().nullable(),
  productGroups: z.array(productGroupSchema),
  createdAt: z.iso.datetime(),
});

export const conversationSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const conversationSchema = conversationSummarySchema.extend({
  messages: z.array(messageSchema),
});

export const conversationListSchema = z.array(conversationSummarySchema);

export const sendMessageSchema = z.object({
  requestId: z.uuid(),
  content: z.string().trim().min(1).max(2000),
});

export type Product = z.infer<typeof productSchema>;
export type ProductGroup = z.infer<typeof productGroupSchema>;
export type Message = z.infer<typeof messageSchema>;
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type SendMessageRequest = z.infer<typeof sendMessageSchema>;
