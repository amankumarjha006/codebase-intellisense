import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { RepositoriesPage } from './pages/RepositoriesPage';
import { RepositoryOverviewPage } from './pages/RepositoryOverviewPage';
import { ChatPage } from './pages/ChatPage';
const ArchitecturePage = lazy(() => import('./pages/ArchitecturePage').then((m) => ({ default: m.ArchitecturePage })));
import { SearchPage } from './pages/SearchPage';
import { FilesPage } from './pages/FilesPage';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import {
  NotFoundPage,
  ServiceUnavailablePage,
  SigningInStatusPage,
  SignInFailedStatusPage,
  AccessDeniedStatusPage,
  SessionExpiredStatusPage,
  ServerUnreachableStatusPage,
} from './pages/StatusPages';

import { AuthProvider } from './lib/AuthContext';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <Routes>
            {/* Public landing page */}
            <Route path="/" element={<LandingPage />} />

            {/* Authenticated application routes wrapped in AppLayout */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/repositories" element={<RepositoriesPage />} />
              <Route path="/repositories/:id" element={<RepositoryOverviewPage />} />
              <Route path="/repositories/:id/chat" element={<ChatPage />} />
              <Route path="/repositories/:id/chat/:conversationId" element={<ChatPage />} />
              <Route path="/repositories/:id/architecture" element={<Suspense fallback={<div className="min-h-screen bg-[#0F0F0E]" />}><ArchitecturePage /></Suspense>} />
              <Route path="/repositories/:id/search" element={<SearchPage />} />
              <Route path="/repositories/:id/files" element={<FilesPage />} />
            </Route>

            {/* Standalone status and error screens */}
            <Route path="/status/signing-in" element={<SigningInStatusPage />} />
            <Route path="/status/sign-in-failed" element={<SignInFailedStatusPage />} />
            <Route path="/status/access-denied" element={<AccessDeniedStatusPage />} />
            <Route path="/status/session-expired" element={<SessionExpiredStatusPage />} />
            <Route path="/status/server-unreachable" element={<ServerUnreachableStatusPage />} />
            <Route path="/503" element={<ServiceUnavailablePage />} />

            {/* Catch-all 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}


export default App;
