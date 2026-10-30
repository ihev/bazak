import type { ProductGroup } from '@bazak/contracts';
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { SearchCriteria } from '../products/search-criteria.js';

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  searchState: text('search_state', { mode: 'json' })
    .$type<SearchCriteria[]>()
    .notNull()
    .default(sql`'[]'`),
});

export const messages = sqliteTable(
  'messages',
  {
    sequence: integer('sequence').primaryKey({ autoIncrement: true }),
    id: text('id').notNull().unique(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant'] }).notNull(),
    status: text('status', { enum: ['pending', 'completed', 'failed'] }).notNull(),
    content: text('content').notNull(),
    requestId: text('request_id'),
    replyToId: text('reply_to_id'),
    productGroups: text('product_groups', { mode: 'json' })
      .$type<ProductGroup[]>()
      .notNull()
      .default(sql`'[]'`),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('messages_conversation_created_idx').on(table.conversationId, table.createdAt),
    uniqueIndex('messages_request_idx').on(table.conversationId, table.requestId),
    uniqueIndex('messages_reply_idx').on(table.replyToId),
    uniqueIndex('messages_one_pending_idx')
      .on(table.conversationId)
      .where(sql`${table.status} = 'pending'`),
  ],
);
