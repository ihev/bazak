import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { LlmModule } from '../llm/llm.module.js';
import { ProductsModule } from '../products/products.module.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';

@Module({
  imports: [ConversationsModule, LlmModule, ProductsModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
