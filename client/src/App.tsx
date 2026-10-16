import * as React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { RepositoryOverviewPage } from './pages/RepositoryOverviewPage';
import { ChatPage } from './pages/ChatPage';
import { ArchitecturePage } from './pages/ArchitecturePage';
import { SearchPage } from './pages/SearchPage';
import { FilesPage } from './pages/FilesPage';
import { AppLayout } from './components/layout/AppLayout';
import {
  NotFoundPage,
  ServiceUnavailablePage,
  SigningInStatusPage,
  SignInFailedStatusPage,
  AccessDeniedStatusPage,
  SessionExpiredStatusPage,
  ServerUnreachableStatusPage,
} from './pages/StatusPages';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public landing page */}
        <Route path="/" element={<LandingPage />} />

        {/* Authenticated application routes wrapped in AppLayout */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/repositories/:id" element={<RepositoryOverviewPage />} />
          <Route path="/repositories/:id/chat" element={<ChatPage />} />
          <Route path="/repositories/:id/chat/:conversationId" element={<ChatPage />} />
          <Route path="/repositories/:id/architecture" element={<ArchitecturePage />} />
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
    </BrowserRouter>
  );
}

export default App;
