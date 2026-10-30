import { useHealth } from '../hooks/use-health';
import styles from './SystemStatus.module.css';

export function SystemStatus() {
  const health = useHealth();

  if (health.isPending) {
    return (
      <div className={styles.panel} role="status">
        Checking the connection…
      </div>
    );
  }

  if (health.isError) {
    return (
      <div className={styles.panel} role="alert">
        <strong>Unable to reach the service</strong>
        <p>Make sure database migrations have run and the API is running.</p>
        <button type="button" disabled={health.isFetching} onClick={() => void health.refetch()}>
          {health.isFetching ? 'Checking…' : 'Try again'}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.panel} role="status">
      <span className={styles.indicator} aria-hidden="true" />
      API connected · Database ready
    </div>
  );
}
