import * as React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from '../ui/sonner';
import { TooltipProvider } from '../ui/tooltip';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { IconRail } from './IconRail';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { CommandPalette } from './CommandPalette';
import { ConnectDrawer } from '../repository/ConnectDrawer';
import { useAuth } from '../../lib/AuthContext';
import { useIndexingStatus } from '../../lib/useIndexingStatus';
import { useTheme } from '../../lib/ThemeContext';

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, error, markSessionExpired } = useAuth();
  const { resetBackoff } = useIndexingStatus();
  const { theme } = useTheme();

  const [connectOpen, setConnectOpen] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);

  const mainRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (loading) return;
    if (error) {
      navigate('/status/server-unreachable', { replace: true });
      return;
    }
    if (!user) {
      markSessionExpired();
    }
  }, [loading, user, error, navigate, markSessionExpired]);

  // Focus main content on route change for screen readers
  React.useEffect(() => {
    if (mainRef.current) {
      mainRef.current.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  const handleConnected = () => {
    resetBackoff();
    setConnectOpen(false);
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-screen w-screen overflow-hidden bg-[var(--color-page)] text-[var(--color-text)]">
        {/* Desktop 56px Navigation Rail */}
        <IconRail onOpenCommand={() => setCommandOpen(true)} />

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden">
          {/* TopBar with breadcrumb, repo switcher, status chip, ⌘K trigger */}
          <TopBar
            onOpenCommand={() => setCommandOpen(true)}
            onOpenConnect={() => setConnectOpen(true)}
          />

          {/* Viewport */}
          <main
            ref={mainRef}
            id="main-content"
            tabIndex={-1}
            className="flex-1 overflow-y-auto focus:outline-none pb-[var(--height-bottomnav)] md:pb-0 flex flex-col"
          >
            <ErrorBoundary>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
                  transition={{
                    duration: 0.26,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="w-full flex-1 flex flex-col min-h-0"
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </ErrorBoundary>
          </main>

          {/* Mobile Bottom Navigation */}
          <BottomNav
            onOpenCommand={() => setCommandOpen(true)}
            onOpenUserMenu={() => setCommandOpen(true)}
          />
        </div>

        {/* Global Command Palette */}
        <CommandPalette
          open={commandOpen}
          onOpenChange={setCommandOpen}
          onOpenConnect={() => {
            setCommandOpen(false);
            setConnectOpen(true);
          }}
        />

        {/* Connect Repository Drawer */}
        <ConnectDrawer
          open={connectOpen}
          onOpenChange={setConnectOpen}
          onConnected={handleConnected}
        />

        {/* Crisp Toasts */}
        <Toaster
          theme={theme}
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border-strong)',
              fontSize: '12px',
            },
          }}
        />
      </div>
    </TooltipProvider>
  );
}

export default AppLayout;
