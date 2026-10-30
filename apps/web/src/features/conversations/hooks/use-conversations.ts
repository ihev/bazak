import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createConversation, getConversation, getConversations } from '../api/conversations';

export const conversationKeys = {
  list: ['conversations'] as const,
  detail: (id: string) => ['conversation', id] as const,
};

export function useConversations() {
  return useQuery({
    queryKey: conversationKeys.list,
    queryFn: ({ signal }) => getConversations(signal),
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: conversationKeys.detail(id),
    queryFn: ({ signal }) => getConversation(id, signal),
    refetchOnMount: 'always',
    refetchInterval: (query) =>
      query.state.data?.messages.some((message) => message.status === 'pending') ? 1500 : false,
  });
}

export function useCreateConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createConversation,
    onSuccess: (conversation) => {
      client.setQueryData(conversationKeys.detail(conversation.id), conversation);
      void client.invalidateQueries({ queryKey: conversationKeys.list });
    },
  });
}
