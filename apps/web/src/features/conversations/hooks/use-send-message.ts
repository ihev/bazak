import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Conversation, SendMessageRequest } from '@bazak/contracts';
import { sendMessage } from '../api/conversations';
import { conversationKeys } from './use-conversations';
import { withFailedMessage, withPendingMessage } from '../message-cache';

export function useSendMessage(conversationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: SendMessageRequest) => sendMessage(conversationId, request),
    onMutate: async (request) => {
      const key = conversationKeys.detail(conversationId);
      await client.cancelQueries({ queryKey: key });
      client.setQueryData<Conversation>(key, (conversation) =>
        conversation ? withPendingMessage(conversation, request) : conversation,
      );
    },
    onSuccess: async (conversation) => {
      const key = conversationKeys.detail(conversation.id);
      await client.cancelQueries({ queryKey: key });
      client.setQueryData(key, conversation);
    },
    onError: async (_error, request) => {
      const key = conversationKeys.detail(conversationId);
      await client.cancelQueries({ queryKey: key });
      // A refetch reconciles this local failure state with durable server state.
      client.setQueryData<Conversation>(key, (conversation) =>
        conversation ? withFailedMessage(conversation, request.requestId) : conversation,
      );
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) });
      void client.invalidateQueries({ queryKey: conversationKeys.list });
    },
  });
}
