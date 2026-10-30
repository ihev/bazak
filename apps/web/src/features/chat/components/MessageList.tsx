import { useEffect, useRef } from 'react';
import type { Message } from '@bazak/contracts';
import { MessageItem } from './MessageItem';
import styles from './MessageList.module.css';

export function MessageList({
  messages,
  busy,
  onRetry,
}: {
  messages: Message[];
  busy: boolean;
  onRetry: (message: Message) => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  const last = messages.at(-1);
  const latestUserId = messages.findLast((message) => message.role === 'user')?.id;
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [last?.id, last?.status]);
  return (
    <div className={styles.messages} aria-label="Chat messages">
      {messages.length === 0 && (
        <div className={styles.welcome}>
          <h2>What are you looking for?</h2>
          <p>Try “Find a smartphone under $500” or “Show me fragrances.”</p>
        </div>
      )}
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          canRetry={!busy && message.role === 'user' && message.id === latestUserId}
          onRetry={onRetry}
        />
      ))}
      {busy && (
        <p className={styles.waiting} role="status">
          Preparing your response…
        </p>
      )}
      <div ref={end} />
    </div>
  );
}
