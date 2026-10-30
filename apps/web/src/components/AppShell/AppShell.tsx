import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './AppShell.module.css';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link className={styles.brand} to="/">
          Bazak <span>Shopping Copilot</span>
        </Link>
        <span className={styles.badge}>Sample product catalog</span>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
