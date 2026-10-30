import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/AppShell/AppShell';
import { FoundationPage } from '../features/foundation/FoundationPage';

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<FoundationPage />} />
        <Route path="*" element={<p>This page does not exist.</p>} />
      </Routes>
    </AppShell>
  );
}
