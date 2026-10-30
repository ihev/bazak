import { SendMessageRequest, sendMessageSchema } from '@bazak/contracts';
import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe.js';
import { ChatService } from './chat.service.js';

@Controller('conversations')
export class ChatController {
  constructor(private readonly service: ChatService) {}

  @Post(':id/messages')
  @HttpCode(200)
  send(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) request: SendMessageRequest,
  ) {
    return this.service.send(id, request);
  }
}
