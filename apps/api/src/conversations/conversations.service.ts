import { Injectable, Logger } from '@nestjs/common';
import { ConversationsRepository } from './conversations.repository.js';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);
  constructor(private readonly repository: ConversationsRepository) {}

  create() {
    const conversation = this.repository.create();
    this.logger.log({ event: 'conversation.created', conversationId: conversation.id });
    return conversation;
  }
  list() {
    const conversations = this.repository.list();
    this.logger.debug({ event: 'conversation.listed', count: conversations.length });
    return conversations;
  }
  get(id: string) {
    const conversation = this.repository.get(id);
    this.logger.debug({
      event: 'conversation.loaded',
      conversationId: id,
      count: conversation.messages.length,
    });
    return conversation;
  }
}
