import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation } from '@bazak/contracts';
import { queryClient as applicationClient } from '../src/app/query-client';
import { ChatPanel } from '../src/features/chat/ChatPanel';
import { useSendMessage } from '../src/features/conversations/hooks/use-send-message';
import { conversationKeys } from '../src/features/conversations/hooks/use-conversations';
import { withFailedMessage, withPendingMessage } from '../src/features/conversations/message-cache';
import { conversation, request } from './fixtures';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const completed: Conversation = {
  ...conversation,
  messages: [
    {
      id: request.requestId,
      requestId: request.requestId,
      content: request.content,
      role: 'user',
      status: 'completed',
      productGroups: [],
      createdAt: conversation.createdAt,
    },
  ],
};

describe('conversation state regressions', () => {
  let client: QueryClient;
  const key = conversationKeys.detail(conversation.id);
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }
  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { ...applicationClient.getDefaultOptions().mutations },
      },
    });
    client.setQueryData(key, conversation);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    client.clear();
    onlineManager.setOnline(true);
  });

  it('settles an offline failure and retries the same optimistic message without duplication', async () => {
    onlineManager.setOnline(false);
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Offline'))
      .mockResolvedValueOnce(Response.json(completed));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useSendMessage(conversation.id), { wrapper: Wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(request)).rejects.toMatchObject({ status: 0 });
    });
    expect(result.current.isPaused).toBe(false);
    expect(client.getQueryData<Conversation>(key)?.messages).toMatchObject([
      { content: request.content, status: 'failed' },
    ]);
    await act(async () => {
      await result.current.mutateAsync(request);
    });
    expect(client.getQueryData<Conversation>(key)?.messages).toHaveLength(1);
    expect(client.getQueryData<Conversation>(key)?.messages[0]?.status).toBe('completed');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('cancels a stale polling read before installing the completed send response', async () => {
    const send = deferred<Response>();
    const read = deferred<Conversation>();
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(send.promise));
    const { result } = renderHook(() => useSendMessage(conversation.id), { wrapper: Wrapper });
    act(() => result.current.mutate(request));
    await waitFor(() =>
      expect(client.getQueryData<Conversation>(key)?.messages[0]?.status).toBe('pending'),
    );
    let readAborted = false;
    const polling = client
      .fetchQuery({
        queryKey: key,
        queryFn: ({ signal }) => {
          signal.addEventListener('abort', () => {
            readAborted = true;
          });
          return read.promise;
        },
      })
      .catch(() => undefined);
    await act(async () => {
      send.resolve(Response.json(completed));
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    read.resolve(withPendingMessage(conversation, request));
    await polling;
    expect(readAborted).toBe(true);
    expect(client.getQueryData(key)).toEqual(completed);
  });

  it('does not demote completed messages or mark a different pending turn as failed', () => {
    expect(withPendingMessage(completed, request)).toEqual(completed);
    expect(withFailedMessage(completed, request.requestId)).toEqual(completed);
    const pending = withPendingMessage(conversation, request);
    expect(withFailedMessage(pending, 'other-request')).toEqual(pending);
  });

  it('preserves cached history and the composer when a background refresh fails', async () => {
    client.setQueryData(key, completed);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { code: 'STORAGE_ERROR', message: 'Unavailable' } },
            { status: 503 },
          ),
        ),
    );
    render(<ChatPanel conversationId={conversation.id} />, { wrapper: Wrapper });
    expect(
      await screen.findByText(
        'Unable to refresh this conversation. Showing the last loaded history.',
      ),
    ).toBeVisible();
    expect(screen.getByText(request.content, { exact: true })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Your message' })).toBeEnabled();
  });

  it('replaces cached history and removes the composer after an authoritative 404', async () => {
    client.setQueryData(key, completed);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 }),
        ),
    );
    render(<ChatPanel conversationId={conversation.id} />, { wrapper: Wrapper });
    expect(await screen.findByText('This conversation no longer exists.')).toBeVisible();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText(request.content, { exact: true })).toBeNull();
  });
});
