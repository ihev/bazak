import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { LlmModule } from '../llm/llm.module.js';
import { ProductsModule } from '../products/products.module.js';

@Module({ imports: [ConversationsModule, LlmModule, ProductsModule] })
export class ChatModule {}
