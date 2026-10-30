import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ConversationsService } from './conversations.service.js';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Post()
  create() {
    return this.service.create();
  }

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.get(id);
  }
}
