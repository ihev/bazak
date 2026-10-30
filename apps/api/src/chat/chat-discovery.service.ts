import { Conversation } from '@bazak/contracts';
import { Injectable } from '@nestjs/common';
import { LlmManager } from '../llm/llm-manager.service.js';
import { ProductSearchService } from '../products/product-search.service.js';
import { SearchCriteria } from '../products/search-criteria.js';
import { summarizeDiscovery } from './discovery-summary.js';

@Injectable()
export class ChatDiscoveryService {
  constructor(
    private readonly llm: LlmManager,
    private readonly products: ProductSearchService,
  ) {}

  async discover(conversation: Conversation, content: string, previousSearches: SearchCriteria[]) {
    const plan = await this.llm.plan({
      message: content,
      categories: await this.products.categories(),
      previousSearches,
      history: conversation.messages
        .filter((message) => message.status === 'completed')
        .slice(-20)
        .map((message) => ({
          role: message.role,
          content: message.content,
          products: message.productGroups.flatMap((group) =>
            group.products.map(({ id, title, price }) => ({ id, title, price })),
          ),
        })),
    });
    const groups =
      plan.action === 'search'
        ? await Promise.all(plan.searches.map((criteria) => this.products.search(criteria)))
        : [];
    return {
      action: plan.action,
      groups,
      content: summarizeDiscovery(plan, groups),
      searchState: plan.action === 'search' ? plan.searches : null,
    };
  }
}
