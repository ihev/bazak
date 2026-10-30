import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Conversation, SendMessageRequest } from '@bazak/contracts';
import { sendMessage } from '../api/conversations';
import { conversationKeys } from './use-conversations';

export function useSendMessage(conversationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: SendMessageRequest) => sendMessage(conversationId, request),
    onMutate: async (request) => {
      const key = conversationKeys.detail(conversationId);
      await client.cancelQueries({ queryKey: key });
      client.setQueryData<Conversation>(key, (conversation) => {
        if (!conversation) return conversation;
        const existing = conversation.messages.find(
          (message) => message.requestId === request.requestId,
        );
        const optimistic = {
          id: request.requestId,
          role: 'user' as const,
          status: 'pending' as const,
          content: request.content,
          requestId: request.requestId,
          productGroups: [],
          createdAt: new Date().toISOString(),
        };
        return {
          ...conversation,
          messages: existing
            ? conversation.messages.map((message) =>
                message.id === existing.id ? { ...message, status: 'pending' as const } : message,
              )
            : [...conversation.messages, optimistic],
        };
      });
    },
    onSuccess: (conversation) => {
      client.setQueryData(conversationKeys.detail(conversation.id), conversation);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) });
      void client.invalidateQueries({ queryKey: conversationKeys.list });
    },
  });
}
