import { SystemStatus } from './components/SystemStatus';
import styles from './FoundationPage.module.css';

export function FoundationPage() {
  return (
    <section aria-labelledby="page-title">
      <p className={styles.eyebrow}>Shopping, through conversation</p>
      <h1 id="page-title">A simpler way to find what you need.</h1>
      <p className={styles.description}>
        The project foundation is ready for review. Product discovery and conversations are the next
        step.
      </p>
      <SystemStatus />
    </section>
  );
}
