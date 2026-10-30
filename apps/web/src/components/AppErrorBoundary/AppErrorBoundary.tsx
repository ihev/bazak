import { Component } from 'react';
import type { ReactNode } from 'react';
import { Feedback } from '../Feedback/Feedback';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(): void {
    if (import.meta.env.DEV) console.error('app.render_failed');
  }

  override render() {
    if (this.state.failed) {
      return (
        <Feedback
          message="The page could not be displayed. Reload to restore your saved conversations."
          onRetry={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}
