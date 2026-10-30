import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { discoveryPlanSchema } from '../discovery-plan.js';
import type { LlmProvider } from '../llm-provider.js';

export class OpenAiProvider implements LlmProvider {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    timeoutMs = 60_000,
  ) {
    this.client = new OpenAI({ apiKey, timeout: timeoutMs, maxRetries: 0 });
  }

  async plan(system: string, input: string) {
    const response = await this.client.responses.parse({
      model: this.model,
      store: false,
      max_output_tokens: 2000,
      input: [
        { role: 'system', content: system },
        { role: 'user', content: input },
      ],
      text: { format: zodTextFormat(discoveryPlanSchema, 'discovery_plan') },
    });
    return discoveryPlanSchema.parse(response.output_parsed);
  }
}
