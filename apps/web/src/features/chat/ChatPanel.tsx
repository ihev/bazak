import type { Message } from '@bazak/contracts';
import { Link } from 'react-router-dom';
import { Feedback } from '../../components/Feedback/Feedback';
import { ApiRequestError } from '../../lib/api-client';
import { useConversation } from '../conversations/hooks/use-conversations';
import { useSendMessage } from '../conversations/hooks/use-send-message';
import { MessageComposer } from './components/MessageComposer';
import { MessageList } from './components/MessageList';
import styles from './ChatPanel.module.css';

export function ChatPanel({ conversationId }: { conversationId: string }) {
  const conversation = useConversation(conversationId);
  const send = useSendMessage(conversationId);
  if (conversation.isPending)
    return (
      <p className={styles.status} role="status">
        Loading conversation…
      </p>
    );
  if (conversation.isError)
    return (
      <div className={styles.status}>
        <Feedback
          message={
            conversation.error instanceof ApiRequestError && conversation.error.status === 404
              ? 'This conversation no longer exists.'
              : 'Unable to load this conversation.'
          }
          onRetry={() => void conversation.refetch()}
          busy={conversation.isFetching}
        />
        <Link to="/">Back to conversations</Link>
      </div>
    );
  const busy =
    send.isPending || conversation.data.messages.some((message) => message.status === 'pending');
  function retry(message: Message) {
    if (message.requestId) send.mutate({ requestId: message.requestId, content: message.content });
  }
  return (
    <section className={styles.panel} aria-label="Current conversation">
      <header className={styles.header}>
        <h1>{conversation.data.title}</h1>
      </header>
      <MessageList messages={conversation.data.messages} busy={busy} onRetry={retry} />
      {send.isError && (
        <div className={styles.error}>
          <Feedback
            message={
              send.error instanceof ApiRequestError
                ? send.error.message
                : 'The service returned an unexpected response. Please retry.'
            }
            onRetry={() => {
              if (send.variables) send.mutate(send.variables);
            }}
            busy={busy}
          />
        </div>
      )}
      <MessageComposer
        disabled={busy}
        onSend={(content) => send.mutate({ requestId: crypto.randomUUID(), content })}
      />
    </section>
  );
}
