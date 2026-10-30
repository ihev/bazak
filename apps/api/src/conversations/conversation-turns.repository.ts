import { ProductGroup, SendMessageRequest } from '@bazak/contracts';
import { ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DatabaseClient } from '../database/database.client.js';
import { databaseOperation } from '../database/database-operation.js';
import { conversations, messages } from '../database/schema.js';
import { SearchCriteria } from '../products/search-criteria.js';

@Injectable()
export class ConversationTurnsRepository implements OnModuleInit {
  constructor(private readonly client: DatabaseClient) {}

  onModuleInit(): void {
    // A single local API process owns pending turns. Interrupted turns remain retryable after restart.
    databaseOperation(() =>
      this.client.db
        .update(messages)
        .set({ status: 'failed' })
        .where(eq(messages.status, 'pending'))
        .run(),
    );
  }

  beginTurn(id: string, request: SendMessageRequest): { messageId: string; cached: boolean } {
    return databaseOperation(() =>
      this.client.db.transaction((tx) => {
        const conversation = this.requireConversation(id);
        const existing = tx
          .select()
          .from(messages)
          .where(and(eq(messages.conversationId, id), eq(messages.requestId, request.requestId)))
          .get();
        if (existing && existing.content !== request.content)
          throw new ConflictException('This request ID was already used for a different message.');
        if (existing?.status === 'completed') return { messageId: existing.id, cached: true };
        const pending = tx
          .select()
          .from(messages)
          .where(and(eq(messages.conversationId, id), eq(messages.status, 'pending')))
          .get();
        if (pending)
          throw new ConflictException('A response is already being prepared. Please wait.');
        if (existing) {
          const latest = tx
            .select()
            .from(messages)
            .where(and(eq(messages.conversationId, id), eq(messages.role, 'user')))
            .orderBy(desc(messages.sequence))
            .get();
          if (latest?.id !== existing.id)
            throw new ConflictException('Only the latest failed message can be retried.');
          tx.update(messages).set({ status: 'pending' }).where(eq(messages.id, existing.id)).run();
          return { messageId: existing.id, cached: false };
        }
        const now = new Date();
        const messageId = randomUUID();
        const hasMessage = tx
          .select({ id: messages.id })
          .from(messages)
          .where(eq(messages.conversationId, id))
          .limit(1)
          .get();
        tx.insert(messages)
          .values({
            id: messageId,
            conversationId: id,
            role: 'user',
            status: 'pending',
            content: request.content,
            requestId: request.requestId,
            createdAt: now,
          })
          .run();
        tx.update(conversations)
          .set({
            title: hasMessage ? conversation.title : request.content.slice(0, 64),
            updatedAt: now,
          })
          .where(eq(conversations.id, id))
          .run();
        return { messageId, cached: false };
      }),
    );
  }

  completeTurn(
    id: string,
    messageId: string,
    content: string,
    groups: ProductGroup[],
    searchState: SearchCriteria[] | null,
  ): void {
    databaseOperation(() =>
      this.client.db.transaction((tx) => {
        const now = new Date();
        tx.insert(messages)
          .values({
            id: randomUUID(),
            conversationId: id,
            role: 'assistant',
            status: 'completed',
            content,
            replyToId: messageId,
            productGroups: groups,
            createdAt: now,
          })
          .run();
        tx.update(messages).set({ status: 'completed' }).where(eq(messages.id, messageId)).run();
        tx.update(conversations)
          .set({ updatedAt: now, ...(searchState ? { searchState } : {}) })
          .where(eq(conversations.id, id))
          .run();
      }),
    );
  }

  failTurn(messageId: string): void {
    databaseOperation(() =>
      this.client.db
        .update(messages)
        .set({ status: 'failed' })
        .where(and(eq(messages.id, messageId), eq(messages.status, 'pending')))
        .run(),
    );
  }

  private requireConversation(id: string) {
    const row = this.client.db.select().from(conversations).where(eq(conversations.id, id)).get();
    if (!row) throw new NotFoundException('Conversation not found.');
    return row;
  }
}
