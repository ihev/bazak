import { conversationSchema, conversationSummarySchema, messageSchema } from '@bazak/contracts';
import type { conversations, messages } from '../database/schema.js';

type ConversationRow = Pick<
  typeof conversations.$inferSelect,
  'id' | 'title' | 'createdAt' | 'updatedAt'
>;
type MessageRow = typeof messages.$inferSelect;

export function toSummary(row: ConversationRow) {
  return conversationSummarySchema.parse({
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export function toConversation(row: ConversationRow, rows: MessageRow[]) {
  return conversationSchema.parse({
    ...toSummary(row),
    messages: rows.map((message) =>
      messageSchema.parse({
        ...message,
        createdAt: message.createdAt.toISOString(),
      }),
    ),
  });
}
