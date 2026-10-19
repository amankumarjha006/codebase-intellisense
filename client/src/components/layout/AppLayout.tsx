import * as React from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { MotionConfig, motion, AnimatePresence } from 'motion/react';
import {
  Menu,
  Search,
  GitBranch,
  Plus,
  Keyboard,
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import { ConnectDrawer } from '../repository/ConnectDrawer';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from '../ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Drawer, DrawerContent } from '../ui/drawer';
import { SkipToContent } from '../ui/A11y';
import { realApi, RepositoryListItemOut } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { classifyAuthError } from '../../lib/auth';
import { spring } from '../../lib/motion';

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, error, markSessionExpired } = useAuth();

  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [connectOpen, setConnectOpen] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [repositories, setRepositories] = React.useState<RepositoryListItemOut[]>([]);

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

  React.useEffect(() => {
    realApi
      .listRepositories(1, 30)
      .then((res) => setRepositories(res.items || []))
      .catch((err: unknown) => {
        if (classifyAuthError(err) === 'unauthenticated') {
          markSessionExpired();
        }
      });
  }, [location.pathname, markSessionExpired]);

  // Focus main content on route change for screen readers
  React.useEffect(() => {
    if (mainRef.current) {
      mainRef.current.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  // Global keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
        return;
      }

      if (!isInput) {
        if (e.key === '/') {
          e.preventDefault();
          setCommandOpen(true);
        } else if (e.key === '?') {
          e.preventDefault();
          setShortcutsOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Determine active repository from URL if on a repo route
  const repoMatch = location.pathname.match(/\/repositories\/([^/]+)/);
  const currentRepoId = repoMatch ? repoMatch[1] : null;
  const currentRepo = currentRepoId
    ? repositories.find((r) => r.id === currentRepoId) || null
    : null;

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--color-page)] text-[var(--color-muted)] font-mono text-xs" role="status" aria-label="Authenticating">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--color-accent)] animate-ping" />
          <span>Authenticating...</span>
        </div>
      </div>
    );
  }

  if (!user || error) {
    return null;
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-screen w-screen overflow-hidden bg-[var(--color-page)] text-[var(--color-text)] font-sans antialiased">
        <SkipToContent />

        {/* Desktop Sidebar — animated width */}
        <motion.div
          className="hidden md:block shrink-0 overflow-hidden"
          animate={{ width: collapsed ? 56 : 240 }}
          transition={spring.gentle}
        >
          <Sidebar
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(!collapsed)}
            onOpenConnect={() => setConnectOpen(true)}
            onOpenShortcuts={() => setShortcutsOpen(true)}
          />
        </motion.div>

        {/* Mobile Navigation Sheet */}
        <Drawer open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <DrawerContent side="left" className="p-0 w-72" aria-label="Navigation menu">
            <Sidebar
              collapsed={false}
              onToggleCollapse={() => setMobileMenuOpen(false)}
              onOpenConnect={() => {
                setMobileMenuOpen(false);
                setConnectOpen(true);
              }}
              onOpenShortcuts={() => {
                setMobileMenuOpen(false);
                setShortcutsOpen(true);
              }}
            />
          </DrawerContent>
        </Drawer>

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top Bar */}
          <header className="flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-md px-4 z-20 shrink-0" role="banner">
            <div className="flex items-center gap-3">
              {/* Mobile menu trigger */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-1.5 rounded-[var(--radius-control)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)] md:hidden transition"
                aria-label="Open navigation menu"
              >
                <Menu size={18} />
              </button>

              {/* Breadcrumbs / Context */}
              <nav className="flex items-center gap-2 text-xs" aria-label="Breadcrumb">
                {currentRepo ? (
                  <>
                    <Link
                      to="/dashboard"
                      className="text-[var(--color-muted)] hover:text-[var(--color-text)] transition hidden sm:inline"
                    >
                      Repositories
                    </Link>
                    <span className="text-[var(--color-border-strong)] hidden sm:inline" aria-hidden="true">/</span>
                    <div className="flex items-center gap-1.5 font-medium text-[var(--color-text)]">
                      <GitBranch size={13} className="text-[var(--color-accent)]" aria-hidden="true" />
                      <span>{currentRepo.owner}/{currentRepo.name}</span>
                    </div>
                  </>
                ) : (
                  <span className="font-medium text-[var(--color-text)]">
                    {location.pathname === '/dashboard' ? 'Repository Overview' : 'Codebase Intellisense'}
                  </span>
                )}
              </nav>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCommandOpen(true)}
                className="flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs text-[var(--color-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] transition"
                aria-label="Open command palette (Ctrl+K)"
              >
                <Search size={13} aria-hidden="true" />
                <span className="hidden sm:inline">Search codebase & commands</span>
                <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-[var(--color-border)] bg-[var(--color-raised)] px-1.5 text-[10px] font-mono text-[var(--color-muted)]" aria-hidden="true">
                  ⌘K
                </kbd>
              </button>

              <Button
                size="sm"
                variant="primary"
                onClick={() => setConnectOpen(true)}
                className="hidden sm:inline-flex"
              >
                <Plus size={14} aria-hidden="true" />
                <span>Connect repo</span>
              </Button>
            </div>
          </header>

          {/* Viewport for Routes */}
          <main
            ref={mainRef}
            id="main-content"
            className="flex-1 overflow-y-auto bg-[var(--color-page)] relative outline-none"
            tabIndex={-1}
            role="main"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                className="h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Global Modals & Utilities */}
        <ConnectDrawer open={connectOpen} onOpenChange={setConnectOpen} />

        {/* Command Palette (cmdk) */}
        <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
          <CommandInput placeholder="Type a command or search repositories..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {repositories.length > 0 && (
              <CommandGroup heading="Repositories">
                {repositories.map((repo) => (
                  <CommandItem
                    key={repo.id}
                    onSelect={() => {
                      navigate(`/repositories/${repo.id}`);
                      setCommandOpen(false);
                    }}
                  >
                    <GitBranch className="mr-2 h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
                    <span>{repo.owner}/{repo.name}</span>
                    <CommandShortcut>{repo.active_version_short_sha || 'main'}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading="Navigation">
              <CommandItem
                onSelect={() => {
                  navigate('/dashboard');
                  setCommandOpen(false);
                }}
              >
                <span>Go to Dashboard</span>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setCommandOpen(false);
                  setConnectOpen(true);
                }}
              >
                <span>Connect New Repository</span>
              </CommandItem>
              {currentRepoId && (
                <>
                  <CommandItem
                    onSelect={() => {
                      navigate(`/repositories/${currentRepoId}/chat`);
                      setCommandOpen(false);
                    }}
                  >
                    <span>Open Chat</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => {
                      navigate(`/repositories/${currentRepoId}/architecture`);
                      setCommandOpen(false);
                    }}
                  >
                    <span>View Architecture</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => {
                      navigate(`/repositories/${currentRepoId}/search`);
                      setCommandOpen(false);
                    }}
                  >
                    <span>Search Repository Code</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => {
                      navigate(`/repositories/${currentRepoId}/files`);
                      setCommandOpen(false);
                    }}
                  >
                    <span>Browse Repository Files</span>
                  </CommandItem>
                </>
              )}
            </CommandGroup>
          </CommandList>
        </CommandDialog>

        {/* Keyboard Shortcuts Modal */}
        <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Keyboard size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
                <span>Keyboard Shortcuts</span>
              </DialogTitle>
              <DialogDescription>
                Quick navigation and command shortcuts across the platform.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2 text-xs" role="list" aria-label="Keyboard shortcuts">
              {[
                { action: 'Command palette', keys: 'Cmd + K / Ctrl + K' },
                { action: 'Quick search', keys: '/' },
                { action: 'Send message', keys: 'Enter' },
                { action: 'New line in prompt', keys: 'Shift + Enter' },
                { action: 'Open this cheatsheet', keys: '?' },
              ].map((shortcut) => (
                <div key={shortcut.action} className="flex items-center justify-between py-1 border-b border-[var(--color-border)] last:border-0" role="listitem">
                  <span className="text-[var(--color-text)]">{shortcut.action}</span>
                  <kbd className="px-2 py-0.5 rounded bg-[var(--color-raised)] border border-[var(--color-border)] font-mono text-[11px]">
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MotionConfig>
  );
}
