import { Injectable } from '@nestjs/common';
import { DatabaseClient } from './database.client.js';
import { conversations } from './schema.js';

@Injectable()
export class DatabaseHealthRepository {
  constructor(private readonly client: DatabaseClient) {}

  assertReadable(): void {
    this.client.db.select({ id: conversations.id }).from(conversations).limit(1).all();
  }
}
