import { Injectable } from '@nestjs/common';
import { ConversationsRepository } from './conversations.repository.js';

@Injectable()
export class ConversationsService {
  constructor(private readonly repository: ConversationsRepository) {}

  create() {
    return this.repository.create();
  }
  list() {
    return this.repository.list();
  }
  get(id: string) {
    return this.repository.get(id);
  }
}
