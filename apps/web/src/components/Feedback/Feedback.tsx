import styles from './Feedback.module.css';

export function Feedback({
  message,
  onRetry,
  busy = false,
}: {
  message: string;
  onRetry?: () => void;
  busy?: boolean;
}) {
  return (
    <div className={styles.feedback} role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} disabled={busy}>
          {busy ? 'Trying…' : 'Try again'}
        </button>
      )}
    </div>
  );
}
