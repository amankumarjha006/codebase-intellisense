import * as React from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { MotionConfig, motion } from 'motion/react';
import { Toaster } from '../ui/sonner';
import { MaterialIcon } from '../ui/MaterialIcon';
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
import { TooltipProvider } from '../ui/tooltip';
import { ErrorBoundary } from '../ui/ErrorBoundary';
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
    let isMounted = true;
    realApi
      .listRepositories(1, 30)
      .then((res) => {
        if (isMounted) setRepositories(res.items || []);
      })
      .catch((err: unknown) => {
        if (classifyAuthError(err) === 'unauthenticated') {
          markSessionExpired();
        }
      });
    return () => {
      isMounted = false;
    };
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
        if (e.key === '?') {
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

  const currentSubView = React.useMemo(() => {
    if (!currentRepoId) return null;
    if (location.pathname.includes('/chat')) return { label: 'Chat', icon: 'chat' };
    if (location.pathname.includes('/architecture')) return { label: 'Architecture', icon: 'account_tree' };
    if (location.pathname.includes('/search')) return { label: 'Search', icon: 'find_in_page' };
    if (location.pathname.includes('/files')) return { label: 'Files', icon: 'folder_open' };
    return { label: 'Overview', icon: 'description' };
  }, [currentRepoId, location.pathname]);

  // If navigating directly to a repository, load its details if missing from initial list
  React.useEffect(() => {
    if (!currentRepoId) return;
    if (repositories.some((r) => r.id === currentRepoId)) return;

    let isMounted = true;
    realApi
      .getRepositoryDetail(currentRepoId)
      .then((detail) => {
        if (!isMounted || !detail) return;
        setRepositories((prev) => {
          if (prev.some((r) => r.id === detail.id)) return prev;
          return [
            ...prev,
            {
              id: detail.id,
              owner: detail.owner,
              name: detail.name,
              is_private: detail.is_private,
              created_at: new Date().toISOString(),
              latest_job_status: null,
              latest_job_failure_code: null,
              active_version_short_sha: detail.active_version?.commit_sha?.slice(0, 7) || null,
              last_indexed_at: detail.active_version?.indexed_at || null,
            },
          ];
        });
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [currentRepoId, repositories]);

  // Back navigation handler: return to repository list or restore context
  const handleBackToRepositories = React.useCallback(() => {
    const navState = location.state as { from?: string; search?: string; filter?: string } | null;
    if (navState?.from) {
      navigate(navState.from, { state: navState });
    } else {
      navigate('/repositories');
    }
  }, [location.state, navigate]);

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

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--color-page)] text-[var(--color-text)] p-6" role="alert">
        <div className="max-w-md w-full rounded-[var(--radius-panel)] border border-[var(--color-error-border)] bg-[var(--color-surface)] p-6 text-center space-y-4">
          <MaterialIcon name="wifi_off" size={28} className="mx-auto text-[var(--color-error)]" />
          <h2 className="text-base font-semibold">Server Unreachable</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Unable to connect to the backend server.
          </p>
          <Button variant="primary" size="sm" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={150}>
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
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {/* Mobile menu trigger */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-1.5 rounded-[var(--radius-control)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)] md:hidden transition shrink-0"
                aria-label="Open navigation menu"
              >
                <MaterialIcon name="menu" size={22} />
              </button>

              {/* Contextual Breadcrumb Navigation */}
              <nav className="flex items-center gap-2 text-xs min-w-0" aria-label="Breadcrumb">
                {currentRepoId ? (
                  <>
                    <button
                      onClick={handleBackToRepositories}
                      className="text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors flex items-center gap-1 shrink-0 font-medium cursor-pointer"
                      title="Return to repositories dashboard"
                    >
                      <MaterialIcon name="arrow_back" size={16} aria-hidden="true" />
                      <span>Repositories</span>
                    </button>
                    <span className="text-[var(--color-border-strong)] select-none" aria-hidden="true">/</span>
                    <Link
                      to={`/repositories/${currentRepoId}`}
                      className="flex items-center gap-1.5 font-medium text-[var(--color-text)] hover:text-[var(--color-mint-accent,#B9E4D0)] transition-colors truncate"
                    >
                      <MaterialIcon name="folder" size={18} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" className="shrink-0" />
                      <span className="truncate font-semibold">{currentRepo ? `${currentRepo.owner}/${currentRepo.name}` : 'Repository'}</span>
                    </Link>
                    {currentRepo?.is_private ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-[var(--color-muted)] border border-[var(--color-border)]">
                        <MaterialIcon name="lock" size={10} aria-hidden="true" />
                        <span>Private</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-[var(--color-muted)] border border-[var(--color-border)]">
                        <MaterialIcon name="public" size={10} aria-hidden="true" />
                        <span>Public</span>
                      </span>
                    )}

                  </>
                ) : (
                  <span className="font-semibold text-sm text-[var(--color-text)] truncate">
                    {location.pathname === '/dashboard' ? 'Dashboard' : location.pathname.startsWith('/repositories') ? 'Repositories' : 'Codebase Intellisense'}
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
                <MaterialIcon name="search" size={18} aria-hidden="true" />
                <span className="hidden sm:inline">Search codebase & commands</span>
                <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-[var(--color-border)] bg-[var(--color-raised)] px-1.5 text-[10px] font-mono text-[var(--color-muted)]" aria-hidden="true">
                  ⌘K
                </kbd>
              </button>

              {location.pathname !== '/dashboard' && location.pathname !== '/repositories' && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setConnectOpen(true)}
                  className="hidden sm:inline-flex"
                >
                  <MaterialIcon name="add" size={18} aria-hidden="true" />
                  <span>Connect repo</span>
                </Button>
              )}
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
            {/* Ambient Background: Subtle gradient mesh */}
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(138,180,248,0.06),transparent_70%),radial-gradient(ellipse_60%_40%_at_85%_10%,rgba(185,228,208,0.035),transparent_60%)]" />
            </div>

            <ErrorBoundary>
              <div className="h-full relative z-10">
                <Outlet />
              </div>
            </ErrorBoundary>
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
                    <MaterialIcon name="folder" size={18} fill={1} color="var(--color-mint-accent, #B9E4D0)" className="mr-2" aria-hidden="true" />
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
                <MaterialIcon name="keyboard" size={22} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                <span>Keyboard Shortcuts</span>
              </DialogTitle>
              <DialogDescription>
                Quick navigation and command shortcuts across the platform.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2 text-xs" role="list" aria-label="Keyboard shortcuts">
              {[
                { action: 'Command palette', keys: '⌘K / Ctrl+K' },
                { action: 'Quick search & filter', keys: '/' },
                { action: 'Tabs 1–5 (Overview..Files)', keys: '1 – 5' },
                { action: 'Send message in Chat', keys: 'Enter' },
                { action: 'New line in Chat', keys: 'Shift + Enter' },
                { action: 'Close panel or modal', keys: 'Esc' },
                { action: 'Toggle this cheat-sheet', keys: '?' },
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
        <Toaster />
      </div>
      </TooltipProvider>
    </MotionConfig>
  );
}
