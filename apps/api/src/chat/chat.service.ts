import { SendMessageRequest } from '@bazak/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { ConversationsRepository } from '../conversations/conversations.repository.js';
import { ConversationTurnsRepository } from '../conversations/conversation-turns.repository.js';
import { LlmManager } from '../llm/llm-manager.service.js';
import { ProductSearchService } from '../products/product-search.service.js';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly repository: ConversationsRepository,
    private readonly turns: ConversationTurnsRepository,
    private readonly llm: LlmManager,
    private readonly products: ProductSearchService,
  ) {}

  async send(id: string, request: SendMessageRequest) {
    const turn = this.turns.beginTurn(id, request);
    if (turn.cached) return this.repository.get(id);
    try {
      const conversation = this.repository.get(id);
      const plan = await this.llm.plan({
        message: request.content,
        categories: await this.products.categories(),
        previousSearches: this.repository.getSearchState(id),
        history: conversation.messages
          .filter((message) => message.status === 'completed')
          .slice(-20)
          .map((message) => ({
            role: message.role,
            content: message.content,
            products: message.productGroups.flatMap((group) =>
              group.products.map(({ id: productId, title, price }) => ({
                id: productId,
                title,
                price,
              })),
            ),
          })),
      });
      const groups =
        plan.action === 'search'
          ? await Promise.all(plan.searches.map((criteria) => this.products.search(criteria)))
          : [];
      const count = groups.reduce((sum, group) => sum + group.products.length, 0);
      const content =
        plan.action !== 'search'
          ? plan.text
          : count
            ? `Here ${count === 1 ? 'is 1 product' : `are ${count} products`} matching your search. You can refine the budget, brand, or product type.`
            : 'No products matched your criteria. Try a different budget, brand, or product type.';
      const finalContent =
        plan.action === 'search' && plan.hasUnsupportedIntent
          ? `${content}\n\nSome parts of your request are outside this product catalog. I searched the supported product types.`
          : content;
      this.turns.completeTurn(
        id,
        turn.messageId,
        finalContent,
        groups,
        plan.action === 'search' ? plan.searches : null,
      );
    } catch (error) {
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
