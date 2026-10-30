import { Injectable, Logger } from '@nestjs/common';
import {
  DependencyUnavailableException,
  describeFailure,
} from '../common/http/dependency-unavailable.exception.js';
import { AppConfigService } from '../config/app-config.service.js';
import { DiscoveryContext } from './discovery-plan.js';
import { discoverySystemPrompt } from './discovery-prompt.js';
import { LlmProvider } from './llm-provider.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import { OpenAiProvider } from './providers/openai.provider.js';
import { LlmResponseError } from './llm-response.error.js';

@Injectable()
export class LlmManager {
  private readonly logger = new Logger(LlmManager.name);
  private readonly provider: LlmProvider;
  private readonly providerName: string;
  private readonly timeoutMs: number;

  constructor(config: AppConfigService) {
    const { provider, apiKey, model, timeoutMs } = config.llm;
    this.providerName = provider;
    this.timeoutMs = timeoutMs;
    this.provider =
      provider === 'gemini'
        ? new GeminiProvider(apiKey, model, timeoutMs)
        : new OpenAiProvider(apiKey, model, timeoutMs);
  }

  async plan(context: DiscoveryContext) {
    const start = performance.now();
    this.logger.log({
      event: 'llm.started',
      provider: this.providerName,
      timeoutMs: this.timeoutMs,
    });
    try {
      const plan = await this.provider.plan(discoverySystemPrompt, JSON.stringify(context));
      if (plan.action !== 'search') {
        if (plan.searches.length) throw new LlmResponseError('unexpected_searches');
        this.logger.log({
          event: 'llm.completed',
          action: plan.action,
          searches: 0,
          durationMs: Math.round(performance.now() - start),
        });
        return plan;
      }
      if (!plan.searches.length) throw new LlmResponseError('missing_searches');
      for (const search of plan.searches) {
        if (!search.category && !search.query?.trim()) throw new LlmResponseError('missing_target');
        if (search.category && !context.categories.includes(search.category))
          throw new LlmResponseError('unknown_category');
        if (
          search.minPrice !== null &&
          search.maxPrice !== null &&
          search.minPrice > search.maxPrice
        )
          throw new LlmResponseError('invalid_price_range');
      }
      this.logger.log({
        event: 'llm.completed',
        action: plan.action,
        searches: plan.searches.length,
        durationMs: Math.round(performance.now() - start),
      });
      return plan;
    } catch (error) {
      const details =
        error instanceof LlmResponseError
          ? { reason: 'invalid_response' as const, fields: [error.issue] }
          : describeFailure(error);
      this.logger.warn({
        event: 'llm.failed',
        provider: this.providerName,
        durationMs: Math.round(performance.now() - start),
        ...details,
      });
      const message =
        details.reason === 'timeout'
          ? 'The AI service took too long to respond. Please retry.'
          : details.reason === 'rate_limit'
            ? 'The AI provider rate limit was reached. Please wait before retrying.'
            : details.reason === 'invalid_response'
              ? 'The AI returned an invalid response. Please retry.'
              : details.upstreamStatus && [400, 401, 403, 404].includes(details.upstreamStatus)
                ? 'The AI provider rejected the request. Check the model and API configuration.'
                : 'The AI service could not prepare a response. Please retry.';
      throw new DependencyUnavailableException('llm', message, error, details);
    }
  }
}
