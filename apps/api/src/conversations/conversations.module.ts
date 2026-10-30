import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ConversationsRepository } from './conversations.repository.js';
import { ConversationsService } from './conversations.service.js';
import { ConversationsController } from './conversations.controller.js';
import { ConversationTurnsRepository } from './conversation-turns.repository.js';

@Module({
  imports: [DatabaseModule],
  controllers: [ConversationsController],
  providers: [ConversationsRepository, ConversationsService, ConversationTurnsRepository],
  exports: [ConversationsRepository, ConversationTurnsRepository],
})
export class ConversationsModule {}
