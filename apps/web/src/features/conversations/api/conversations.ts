import { conversationListSchema, conversationSchema } from '@bazak/contracts';
import type { SendMessageRequest } from '@bazak/contracts';
import { requestJson } from '../../../lib/api-client';

export async function getConversations(signal: AbortSignal) {
  return conversationListSchema.parse(await requestJson('/conversations', { signal }));
}

export async function getConversation(id: string, signal: AbortSignal) {
  return conversationSchema.parse(
    await requestJson(`/conversations/${encodeURIComponent(id)}`, { signal }),
  );
}

export async function createConversation() {
  return conversationSchema.parse(await requestJson('/conversations', { method: 'POST' }));
}

export async function sendMessage(id: string, request: SendMessageRequest) {
  return conversationSchema.parse(
    await requestJson(`/conversations/${encodeURIComponent(id)}/messages`, {
      method: 'POST',
      body: request,
    }),
  );
}
