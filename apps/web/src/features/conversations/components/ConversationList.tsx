import type { ConversationSummary } from '@bazak/contracts';
import { NavLink } from 'react-router-dom';
import styles from './ConversationList.module.css';

export function ConversationList({ conversations }: { conversations: ConversationSummary[] }) {
  if (!conversations.length)
    return <p className={styles.empty}>Your conversations will appear here.</p>;
  return (
    <nav aria-label="Conversations" className={styles.list}>
      {conversations.map((conversation) => (
        <NavLink
          key={conversation.id}
          to={`/chats/${conversation.id}`}
          className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}
        >
          <span className={styles.title}>{conversation.title}</span>
          <time dateTime={conversation.updatedAt}>
            {new Date(conversation.updatedAt).toLocaleDateString('en', {
              month: 'short',
              day: 'numeric',
            })}
          </time>
        </NavLink>
      ))}
    </nav>
  );
}
