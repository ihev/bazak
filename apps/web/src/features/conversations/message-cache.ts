import type { Conversation, SendMessageRequest } from '@bazak/contracts';

export function withPendingMessage(
  conversation: Conversation,
  request: SendMessageRequest,
): Conversation {
  const existing = conversation.messages.find((message) => message.requestId === request.requestId);
  if (existing) {
    return {
      ...conversation,
      messages: conversation.messages.map((message) =>
        message.id === existing.id && message.status !== 'completed'
          ? { ...message, status: 'pending' }
          : message,
      ),
    };
  }
  return {
    ...conversation,
    messages: [
      ...conversation.messages,
      {
        id: request.requestId,
        role: 'user',
        status: 'pending',
        content: request.content,
        requestId: request.requestId,
        productGroups: [],
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

export function withFailedMessage(conversation: Conversation, requestId: string): Conversation {
  return {
    ...conversation,
    messages: conversation.messages.map((message) =>
      message.requestId === requestId && message.status === 'pending'
        ? { ...message, status: 'failed' }
        : message,
    ),
  };
}
