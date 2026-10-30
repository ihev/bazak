import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { discoveryPlanSchema } from '../discovery-plan.js';
import type { LlmProvider } from '../llm-provider.js';
import { LlmResponseError } from '../llm-response.error.js';

export class GeminiProvider implements LlmProvider {
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    timeoutMs = 60_000,
  ) {
    this.client = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: timeoutMs, retryOptions: { attempts: 1 } },
    });
  }

  async plan(system: string, input: string) {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: input,
      config: {
        systemInstruction: system,
        responseMimeType: 'application/json',
        responseJsonSchema: z.toJSONSchema(discoveryPlanSchema),
        maxOutputTokens: 4000,
      },
    });
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS') throw new LlmResponseError('output_limit');
    if (finishReason && finishReason !== 'STOP') throw new LlmResponseError('blocked_response');
    const text = response.text;
    if (!text) throw new LlmResponseError('empty_response');
    return discoveryPlanSchema.parse(JSON.parse(text));
  }
}
