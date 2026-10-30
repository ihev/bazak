import { SendMessageRequest } from '@bazak/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { ConversationsRepository } from '../conversations/conversations.repository.js';
import { ConversationTurnsRepository } from '../conversations/conversation-turns.repository.js';
import { ChatDiscoveryService } from './chat-discovery.service.js';
import { RequestContext } from '../logging/request-context.service.js';
import { DependencyUnavailableException } from '../common/http/dependency-unavailable.exception.js';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly repository: ConversationsRepository,
    private readonly turns: ConversationTurnsRepository,
    private readonly discovery: ChatDiscoveryService,
    private readonly context: RequestContext,
  ) {}

  async send(id: string, request: SendMessageRequest) {
    this.context.bindTurn(id, request.requestId);
    const start = performance.now();
    this.logger.log({ event: 'turn.received' });
    const turn = this.turns.beginTurn(id, request);
    if (turn.cached) {
      this.logger.log({ event: 'turn.replayed', cached: true });
      return this.repository.get(id);
    }
    this.logger.log({ event: 'turn.persisted' });
    try {
      const conversation = this.repository.get(id);
      const result = await this.discovery.discover(
        conversation,
        request.content,
        this.repository.getSearchState(id),
      );
      this.turns.completeTurn(
        id,
        turn.messageId,
        result.content,
        result.groups,
        result.searchState,
      );
      this.logger.log({
        event: 'turn.completed',
        durationMs: Math.round(performance.now() - start),
        action: result.action,
        groups: result.groups.length,
        products: result.groups.reduce((sum, group) => sum + group.products.length, 0),
      });
    } catch (error) {
      this.logger.warn({
        event: 'turn.failed',
        durationMs: Math.round(performance.now() - start),
        ...(error instanceof DependencyUnavailableException
          ? { dependency: error.dependency, ...error.details }
          : {}),
      });
      try {
        this.turns.failTurn(turn.messageId);
      } catch {
        this.logger.error(
          'Could not mark an interrupted turn as failed. It will be recovered on API restart.',
        );
      }
      throw error;
    }
    return this.repository.get(id);
  }
}
