import { useNavigate, useParams } from 'react-router-dom';
import { Feedback } from '../../components/Feedback/Feedback';
import { ConversationList } from '../conversations/components/ConversationList';
import { useConversations, useCreateConversation } from '../conversations/hooks/use-conversations';
import { ChatPanel } from './ChatPanel';
import styles from './ChatPage.module.css';

export function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const conversations = useConversations();
  const create = useCreateConversation();
  function startConversation() {
    create.mutate(undefined, {
      onSuccess: (conversation) => void navigate(`/chats/${conversation.id}`),
    });
  }
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar} aria-label="Conversation sidebar">
        <button
          className={styles.newChat}
          type="button"
          disabled={create.isPending}
          onClick={startConversation}
        >
          {create.isPending ? 'Creating…' : '+ New conversation'}
        </button>
        {create.isError && <Feedback message="Unable to create a conversation. Please retry." />}
        <h2>Conversations</h2>
        {conversations.isRefetchError && conversations.data && (
          <Feedback
            message="Unable to refresh conversations. Showing the last loaded list."
            onRetry={() => void conversations.refetch()}
            busy={conversations.isFetching}
          />
        )}
        {conversations.isPending ? (
          <p role="status">Loading…</p>
        ) : !conversations.data ? (
          <Feedback
            message="Unable to load conversations."
            onRetry={() => void conversations.refetch()}
            busy={conversations.isFetching}
          />
        ) : (
          <ConversationList conversations={conversations.data} />
        )}
      </aside>
      <div className={styles.chat}>
        {conversationId ? (
          <ChatPanel key={conversationId} conversationId={conversationId} />
        ) : (
          <section className={styles.welcome}>
            <p className={styles.eyebrow}>Your shopping copilot</p>
            <h1>Find something that fits.</h1>
            <p>
              Tell me what you need, set a budget, and explore products together. Your conversations
              are saved so you can pick up where you left off.
            </p>
            <button
              className={styles.newChat}
              type="button"
              disabled={create.isPending}
              onClick={startConversation}
            >
              {create.isPending ? 'Creating…' : 'Start a conversation'}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
