import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/AppShell/AppShell';
import { AppErrorBoundary } from '../components/AppErrorBoundary/AppErrorBoundary';

const ChatPage = lazy(() =>
  import('../features/chat/ChatPage').then((module) => ({ default: module.ChatPage })),
);

export function App() {
  return (
    <AppShell>
      <AppErrorBoundary>
        <Suspense fallback={<p role="status">Loading conversations…</p>}>
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/chats/:conversationId" element={<ChatPage />} />
            <Route path="*" element={<p>This page does not exist.</p>} />
          </Routes>
        </Suspense>
      </AppErrorBoundary>
    </AppShell>
  );
}
