import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import styles from './MessageComposer.module.css';

export function MessageComposer({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (content: string) => void;
}) {
  const [content, setContent] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = content.trim();
    if (disabled || !trimmed) return;
    onSend(trimmed);
    setContent('');
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }
  return (
    <form className={styles.composer} onSubmit={submit}>
      <label htmlFor="message" className={styles.label}>
        Your message
      </label>
      <div className={styles.row}>
        <textarea
          id="message"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Describe what you need…"
          maxLength={2000}
          rows={2}
          disabled={disabled}
        />
        <button type="submit" disabled={disabled || !content.trim()}>
          Send
        </button>
      </div>
      <p>Enter to send · Shift + Enter for a new line · Prices in USD</p>
    </form>
  );
}
