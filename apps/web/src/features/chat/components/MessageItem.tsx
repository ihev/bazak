import type { Message } from '@bazak/contracts';
import { ProductResults } from '../../products/components/ProductResults';
import styles from './MessageItem.module.css';

export function MessageItem({
  message,
  canRetry,
  onRetry,
}: {
  message: Message;
  canRetry: boolean;
  onRetry: (message: Message) => void;
}) {
  return (
    <article
      className={`${styles.message} ${message.role === 'user' ? styles.user : styles.assistant}`}
      aria-label={message.role === 'user' ? 'Your message' : 'Assistant message'}
    >
      <p className={styles.author}>{message.role === 'user' ? 'You' : 'Shopping Copilot'}</p>
      <p className={styles.content}>{message.content}</p>
      {message.status === 'failed' && (
        <p className={styles.failure}>
          Response interrupted.{' '}
          {canRetry && (
            <button type="button" onClick={() => onRetry(message)}>
              Retry this message
            </button>
          )}
        </p>
      )}
      <ProductResults groups={message.productGroups} />
    </article>
  );
}
