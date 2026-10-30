import { Injectable, NotFoundException } from '@nestjs/common';
import { asc, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DatabaseClient } from '../database/database.client.js';
import { databaseOperation } from '../database/database-operation.js';
import { conversations, messages } from '../database/schema.js';
import { toConversation, toSummary } from './conversation.mapper.js';
import { searchCriteriaSchema, SearchCriteria } from '../products/search-criteria.js';
import { z } from 'zod';

@Injectable()
export class ConversationsRepository {
  constructor(private readonly client: DatabaseClient) {}

  create() {
    return databaseOperation(() => {
      const now = new Date();
      const row = this.client.db
        .insert(conversations)
        .values({ id: randomUUID(), title: 'New conversation', createdAt: now, updatedAt: now })
        .returning()
        .get();
      return toConversation(row, []);
    });
  }

  list() {
    return databaseOperation(() =>
      this.client.db
        .select()
        .from(conversations)
        .orderBy(desc(conversations.updatedAt), asc(conversations.id))
        .all()
        .map(toSummary),
    );
  }

  get(id: string) {
    return databaseOperation(() => {
      const row = this.requireConversation(id);
      const rows = this.client.db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, id))
        .orderBy(asc(messages.sequence))
        .all();
      return toConversation(row, rows);
    });
  }

  getSearchState(id: string): SearchCriteria[] {
    return databaseOperation(() =>
      z.array(searchCriteriaSchema).parse(this.requireConversation(id).searchState),
    );
  }

  private requireConversation(id: string) {
    const row = this.client.db.select().from(conversations).where(eq(conversations.id, id)).get();
    if (!row) throw new NotFoundException('Conversation not found.');
    return row;
  }
}
