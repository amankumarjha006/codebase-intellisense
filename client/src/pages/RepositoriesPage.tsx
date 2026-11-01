import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { ApiError, RepositoryListItemOut } from '../lib/api';
import { formatRelativeTime, shortSha } from '../lib/utils';
import { RepositoryStatusCell } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Card, CardHeader, CardDescription, CardContent } from '../components/ui/card';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '../components/ui/table';
import { ConnectDrawer } from '../components/repository/ConnectDrawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import { useRepositoryPolling } from '../lib/useRepositoryPolling';
import { AnimatedPage } from '../components/ui/AnimatedPage';
import { LiveRegion } from '../components/ui/A11y';
import { useAuth } from '../lib/AuthContext';
import { usePinnedRepos } from '../lib/pinnedRepos';
import { toast } from '../components/ui/sonner';
import { motion } from 'motion/react';

type StatusFilter = 'ALL' | 'READY' | 'ACTIVE' | 'FAILED';

export function RepositoriesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { markSessionExpired } = useAuth();
  const { isPinned, togglePin } = usePinnedRepos();
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Restore previous search/filter context if returning from repository navigation
  const navState = location.state as { from?: string; search?: string; filter?: StatusFilter } | null;

  const [searchInput, setSearchInput] = React.useState(navState?.search || '');
  const [debouncedSearch, setDebouncedSearch] = React.useState(navState?.search || '');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>(navState?.filter || 'ALL');
  const [connectOpen, setConnectOpen] = React.useState(false);
  const [copiedRequestId, setCopiedRequestId] = React.useState(false);
  const [repoToDelete, setRepoToDelete] = React.useState<RepositoryListItemOut | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [a11yAnnouncement, setA11yAnnouncement] = React.useState('');

  // Quick hotkey: press '/' to focus table filter input
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounce search input by 300ms
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const {
    repositories,
    total,
    loading,
    isPolling,
    error,
    refetch,
    triggerIndex,
    deleteRepository,
  } = useRepositoryPolling({
    page: 1,
    limit: 100,
    search: debouncedSearch,
    onSessionExpired: markSessionExpired,
  });

  const safeRepos = React.useMemo(() => repositories || [], [repositories]);

  // Navigate to repository preserving current search & filter state
  const navigateToRepo = React.useCallback(
    (repoId: string) => {
      navigate(`/repositories/${repoId}`, {
        state: { from: '/repositories', search: debouncedSearch, filter: statusFilter },
      });
    },
    [navigate, debouncedSearch, statusFilter]
  );

  // Calculate honest metrics supplied by backend
  const readyCount = React.useMemo(() => {
    return safeRepos.filter(
      (r) => r.latest_job_status === 'READY' || (r.active_version_short_sha && !r.latest_job_status)
    ).length;
  }, [safeRepos]);

  const activeCount = React.useMemo(() => {
    return safeRepos.filter((r) =>
      ['QUEUED', 'FETCHING', 'INDEXING', 'ANALYZING'].includes(r.latest_job_status || '')
    ).length;
  }, [safeRepos]);

  const alertCount = React.useMemo(() => {
    return safeRepos.filter((r) => r.latest_job_status === 'FAILED').length;
  }, [safeRepos]);

  // Most recent indexing activity timestamp & repo
  const mostRecentSync = React.useMemo(() => {
    const sorted = [...safeRepos]
      .filter((r) => r.last_indexed_at)
      .sort((a, b) => new Date(b.last_indexed_at!).getTime() - new Date(a.last_indexed_at!).getTime());
    return sorted[0] || null;
  }, [safeRepos]);


  // Filter repositories based on statusFilter
  const filteredRepositories = React.useMemo(() => {
    if (statusFilter === 'ALL') return safeRepos;
    if (statusFilter === 'READY') {
      return safeRepos.filter(
        (r) => r.latest_job_status === 'READY' || (r.active_version_short_sha && !r.latest_job_status)
      );
    }
    if (statusFilter === 'ACTIVE') {
      return safeRepos.filter((r) =>
        ['QUEUED', 'FETCHING', 'INDEXING', 'ANALYZING'].includes(r.latest_job_status || '')
      );
    }
    if (statusFilter === 'FAILED') {
      return safeRepos.filter((r) => r.latest_job_status === 'FAILED');
    }
    return safeRepos;
  }, [safeRepos, statusFilter]);

  React.useEffect(() => {
    if (loading) {
      setA11yAnnouncement('Loading repositories...');
    } else if (error) {
      setA11yAnnouncement('Error loading repositories.');
    } else {
      setA11yAnnouncement(`Loaded ${repositories.length} repositories.`);
    }
  }, [loading, error, repositories.length]);

  const handleCopyRequestId = (reqId: string) => {
    navigator.clipboard.writeText(reqId);
    setCopiedRequestId(true);
    setTimeout(() => setCopiedRequestId(false), 2000);
  };

  const requestId = error instanceof ApiError ? error.requestId : null;
  const httpStatus = error instanceof ApiError ? error.status : null;

  return (
    <AnimatedPage className="relative p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <LiveRegion message={a11yAnnouncement} />

      {/* Top Ambient Subtle Glow */}
      <div
        className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 -z-10 w-full max-w-6xl h-80 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(185,228,208,0.06),transparent_70%)]"
        aria-hidden="true"
      />

      {/* Page Heading & Primary Actions */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[var(--color-border)]/60">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)] font-sans">
              Repositories
            </h1>
            {!loading && !error && (repositories.length > 0 || Boolean(debouncedSearch)) && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-[var(--color-mint-selected-bg,#1B332A)] text-[var(--color-mint-accent,#B9E4D0)] border border-[rgba(185,228,208,0.25)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-mint-accent,#B9E4D0)] animate-pulse" aria-hidden="true" />
                <span>{total} {total === 1 ? 'codebase' : 'codebases'}</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
            Manage connected GitHub repositories, view indexing status, and search codebase architecture.
          </p>
        </div>

        {/* Sync & Connect Actions */}
        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={refetch}
            disabled={loading}
            aria-label="Synchronize repository states"
            title="Synchronize repository states"
            className="h-9 px-3 gap-1.5 border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-raised)] transition cursor-pointer"
          >
            <MaterialIcon name="sync" size={17} spin={loading || isPolling} aria-hidden="true" />
            <span className="hidden sm:inline font-medium text-xs">Sync</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setConnectOpen(true)}
            aria-label="Connect new repository"
            className="h-9 px-4 font-semibold text-xs gap-1.5 bg-[var(--color-mint-accent,#B9E4D0)] text-[#0C0C0B] hover:bg-[var(--color-mint-hover,#D0F1E0)] transition shadow-sm hover:shadow-[0_0_20px_rgba(185,228,208,0.25)] cursor-pointer"
          >
            <MaterialIcon name="add" size={18} aria-hidden="true" />
            <span>Connect Repository</span>
          </Button>
        </div>
      </header>

      {/* Compact Catalog Summary Strip */}
      {!loading && !error && repositories.length > 0 && (
        <section
          aria-label="Repository catalog summary"
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]/90 shadow-xs"
        >
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-[var(--color-text)]">
              <MaterialIcon name="folder" size={16} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
              <span>
                <strong className="font-mono text-sm">{total}</strong> {total === 1 ? 'codebase' : 'codebases'}
              </span>
            </span>
            <span className="text-[var(--color-border)] font-mono select-none">|</span>
            <span className="inline-flex items-center gap-1.5 text-[var(--color-text-secondary)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-mint-accent,#B9E4D0)]" aria-hidden="true" />
              <span>
                <strong className="font-mono text-[var(--color-text)]">{readyCount}</strong> ready to search
              </span>
            </span>
            {activeCount > 0 && (
              <>
                <span className="text-[var(--color-border)] font-mono select-none">|</span>
                <span className="inline-flex items-center gap-1.5 text-[var(--color-warning)]">
                  <MaterialIcon name="sync" size={14} spin aria-hidden="true" />
                  <span>
                    <strong className="font-mono">{activeCount}</strong> indexing
                  </span>
                </span>
              </>
            )}
            {alertCount > 0 && (
              <>
                <span className="text-[var(--color-border)] font-mono select-none">|</span>
                <span className="inline-flex items-center gap-1.5 text-[var(--color-error)]">
                  <MaterialIcon name="error" size={14} aria-hidden="true" />
                  <span>
                    <strong className="font-mono">{alertCount}</strong> failed
                  </span>
                </span>
              </>
            )}
          </div>

          {mostRecentSync?.last_indexed_at && (
            <div className="text-[11px] font-mono text-[var(--color-muted)] flex items-center gap-1.5">
              <MaterialIcon name="schedule" size={13} aria-hidden="true" />
              <span>Last sync: {formatRelativeTime(mostRecentSync.last_indexed_at)}</span>
            </div>
          )}
        </section>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div
          role="status"
          aria-label="Loading repository catalog"
          className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-[var(--radius-panel)]" />
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div role="alert" aria-live="assertive" className="space-y-4">
          <div className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center space-y-4 max-w-md mx-auto shadow-sm">
            <div
              className="h-12 w-12 rounded-full bg-[var(--color-error-tint)] border border-[var(--color-error-border)] flex items-center justify-center text-[var(--color-error)] mx-auto"
              aria-hidden="true"
            >
              <MaterialIcon name="wifi_off" size={24} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                Unable to load repositories
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Could not retrieve repository records. Please check your connection and try again.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <Button variant="primary" size="sm" onClick={refetch} className="cursor-pointer">
                <MaterialIcon name="sync" size={18} aria-hidden="true" />
                <span>Retry</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Meaningful Empty State: 0 Repositories Connected */}
      {!loading && !error && total === 0 && !debouncedSearch && (
        <section
          role="status"
          aria-label="No repositories connected"
          className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 sm:p-12 text-center space-y-6 max-w-2xl mx-auto shadow-sm"
        >
          <div
            className="h-14 w-14 rounded-2xl bg-[var(--color-raised)] border border-[var(--color-border-strong)] flex items-center justify-center text-[var(--color-mint-accent,#B9E4D0)] mx-auto"
            aria-hidden="true"
          >
            <MaterialIcon name="terminal" size={28} fill={1} color="var(--color-mint-accent, #B9E4D0)" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-lg font-bold tracking-tight text-[var(--color-text)] font-sans">
              Connect your first repository
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Connect your GitHub repositories to search code, explore dependencies, and ask questions.
            </p>
          </div>

          <div className="pt-1">
            <Button
              variant="primary"
              onClick={() => setConnectOpen(true)}
              aria-label="Connect your first repository"
              className="gap-2 px-5 py-2 font-semibold text-xs cursor-pointer"
            >
              <MaterialIcon name="add" size={18} aria-hidden="true" />
              <span>Connect repository</span>
            </Button>
          </div>

          {/* Three Feature Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-[var(--color-border)] text-left">
            <div className="p-3.5 rounded-[var(--radius-control)] bg-[var(--color-raised)]/40 border border-[var(--color-border)]/50 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-[var(--color-muted)]">
                <MaterialIcon name="search" size={16} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                <span>Code Search</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-normal">
                Instant natural language and symbol search across your repository files.
              </p>
            </div>

            <div className="p-3.5 rounded-[var(--radius-control)] bg-[var(--color-raised)]/40 border border-[var(--color-border)]/50 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-[var(--color-muted)]">
                <MaterialIcon name="terminal" size={16} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                <span>Verified Answers</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-normal">
                Ask questions in plain English with direct links to the relevant lines in your code.
              </p>
            </div>

            <div className="p-3.5 rounded-[var(--radius-control)] bg-[var(--color-raised)]/40 border border-[var(--color-border)]/50 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-[var(--color-muted)]">
                <MaterialIcon name="account_tree" size={16} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                <span>Architecture Maps</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-normal">
                Visualize module relationships and dependencies across your codebase.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Populated Repository List & Scannable Table */}
      {!loading && !error && repositories.length > 0 && (
        <section aria-label="Repositories list" className="space-y-4">
          {/* Controls: Search & Filter Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input with Hotkey */}
            <div className="relative flex-1 max-w-md">
              <MaterialIcon
                name="search"
                size={18}
                className="absolute left-3 top-2.5 text-[var(--color-muted)] pointer-events-none"
                aria-hidden="true"
              />
              <Input
                ref={searchInputRef}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search repositories by name or owner..."
                aria-label="Search repositories by name or owner"
                className="pl-9 pr-14 text-xs h-9 bg-[var(--color-surface)] border-[var(--color-border)] rounded-[var(--radius-control)] focus:border-[var(--color-mint-accent,#B9E4D0)] transition-colors"
              />
              <div className="absolute right-2.5 top-2 flex items-center gap-1">
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      searchInputRef.current?.focus();
                    }}
                    className="p-0.5 rounded text-[var(--color-muted)] hover:text-[var(--color-text)] transition cursor-pointer"
                    aria-label="Clear search input"
                  >
                    <MaterialIcon name="close" size={15} />
                  </button>
                )}
                <kbd
                  aria-hidden="true"
                  className="hidden sm:inline-flex items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-raised)] h-5 px-1.5 text-[10px] font-mono text-[var(--color-muted)] select-none"
                >
                  /
                </kbd>
              </div>
            </div>

            {/* Filter Pills with Framer Motion & Accessible States */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label="Filter by verification state">
              <button
                onClick={() => setStatusFilter('ALL')}
                aria-pressed={statusFilter === 'ALL'}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer select-none ${
                  statusFilter === 'ALL'
                    ? 'text-[var(--color-mint-accent,#B9E4D0)] font-semibold'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/50'
                }`}
              >
                {statusFilter === 'ALL' && (
                  <motion.div
                    layoutId="active-repositories-filter"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    className="absolute inset-0 rounded-lg bg-[var(--color-mint-selected-bg,#1B332A)] border border-[rgba(185,228,208,0.25)] shadow-xs"
                  />
                )}
                <span className="relative z-10 font-mono">All ({total})</span>
              </button>

              <button
                onClick={() => setStatusFilter('READY')}
                aria-pressed={statusFilter === 'READY'}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer select-none ${
                  statusFilter === 'READY'
                    ? 'text-[var(--color-mint-accent,#B9E4D0)] font-semibold'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/50'
                }`}
              >
                {statusFilter === 'READY' && (
                  <motion.div
                    layoutId="active-repositories-filter"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    className="absolute inset-0 rounded-lg bg-[var(--color-mint-selected-bg,#1B332A)] border border-[rgba(185,228,208,0.25)] shadow-xs"
                  />
                )}
                <span className="relative z-10 font-mono">Indexed ({readyCount})</span>
              </button>

              {activeCount > 0 && (
                <button
                  onClick={() => setStatusFilter('ACTIVE')}
                  aria-pressed={statusFilter === 'ACTIVE'}
                  className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer select-none flex items-center gap-1.5 ${
                    statusFilter === 'ACTIVE'
                      ? 'text-[var(--color-warning)] font-semibold'
                      : 'text-[var(--color-warning)] hover:bg-[var(--color-raised)]/50'
                  }`}
                >
                  {statusFilter === 'ACTIVE' && (
                    <motion.div
                      layoutId="active-repositories-filter"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      className="absolute inset-0 rounded-lg bg-[var(--color-warning-tint)] border border-[rgba(251,191,36,0.3)] shadow-xs"
                    />
                  )}
                  <MaterialIcon name="sync" size={14} spin aria-hidden="true" className="relative z-10" />
                  <span className="relative z-10 font-mono">Active ({activeCount})</span>
                </button>
              )}

              {alertCount > 0 && (
                <button
                  onClick={() => setStatusFilter('FAILED')}
                  aria-pressed={statusFilter === 'FAILED'}
                  className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer select-none flex items-center gap-1.5 ${
                    statusFilter === 'FAILED'
                      ? 'text-[var(--color-error)] font-semibold'
                      : 'text-[var(--color-error)] hover:bg-[var(--color-raised)]/50'
                  }`}
                >
                  {statusFilter === 'FAILED' && (
                    <motion.div
                      layoutId="active-repositories-filter"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      className="absolute inset-0 rounded-lg bg-[var(--color-error-tint)] border border-[var(--color-error-border)] shadow-xs"
                    />
                  )}
                  <MaterialIcon name="error" size={14} aria-hidden="true" className="relative z-10" />
                  <span className="relative z-10 font-mono">Failed ({alertCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* Scannable Modern Table */}
          <div className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-lg shadow-black/20">
            <Table aria-label="Connected repositories">
              <TableHeader>
                <TableRow className="bg-[var(--color-raised)]/60 hover:bg-[var(--color-raised)]/60 border-b border-[var(--color-border)]">
                  <TableHead className="py-3 px-4 font-semibold text-[10px] uppercase font-mono tracking-wider text-[var(--color-muted)]">
                    Repository
                  </TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-[10px] uppercase font-mono tracking-wider text-[var(--color-muted)]">
                    Branch & Commit
                  </TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-[10px] uppercase font-mono tracking-wider text-[var(--color-muted)]">
                    Status
                  </TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-[10px] uppercase font-mono tracking-wider text-[var(--color-muted)]">
                    Last Indexed
                  </TableHead>
                  <TableHead className="py-3 px-4 text-right font-semibold text-[10px] uppercase font-mono tracking-wider text-[var(--color-muted)]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-[var(--color-border)]/60">
                {filteredRepositories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-14 text-center">
                      <div className="flex flex-col items-center justify-center gap-2.5 text-xs max-w-sm mx-auto">
                        <div className="h-11 w-11 rounded-2xl bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-muted)] shadow-inner">
                          <MaterialIcon name="search_off" size={22} aria-hidden="true" />
                        </div>
                        <p className="font-semibold text-sm text-[var(--color-text)]">No matching repositories</p>
                        <p className="text-[var(--color-text-secondary)] text-xs leading-relaxed">
                          {debouncedSearch
                            ? `No connected repositories match the query "${debouncedSearch}".`
                            : `No repositories currently have the status "${statusFilter}".`}
                        </p>
                        {(debouncedSearch || statusFilter !== 'ALL') && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSearchInput('');
                              setStatusFilter('ALL');
                            }}
                            className="mt-2 h-8 px-3.5 text-xs font-medium gap-1.5 cursor-pointer border-[var(--color-border)] hover:border-[var(--color-mint-accent,#B9E4D0)]/40"
                          >
                            <MaterialIcon name="restart_alt" size={15} aria-hidden="true" />
                            <span>Reset search & filters</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRepositories.map((repo) => {
                    const activeSha = repo.active_version_short_sha || '';
                    return (
                      <TableRow
                        key={repo.id}
                        onClick={() => navigateToRepo(repo.id)}
                        className="cursor-pointer group hover:bg-[var(--color-raised)]/60 transition-colors"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigateToRepo(repo.id);
                          }
                        }}
                        aria-label={`Open repository ${repo.owner}/${repo.name}`}
                      >
                        {/* 1. Repository Name & Visibility Tag */}
                        <TableCell className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="h-9 w-9 rounded-xl bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-mint-accent,#B9E4D0)] shrink-0 transition-all group-hover:scale-105 group-hover:border-[var(--color-mint-accent,#B9E4D0)]/40 shadow-xs"
                              aria-hidden="true"
                            >
                              <MaterialIcon name="folder" size={20} fill={1} color="var(--color-mint-accent, #B9E4D0)" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm text-[var(--color-text)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition-colors">
                                <span className="text-[var(--color-muted)] font-normal font-mono">{repo.owner}/</span>
                                <span className="truncate">{repo.name}</span>
                                {isPinned(repo.id) && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      togglePin(repo.id);
                                    }}
                                    title="Pinned to sidebar (click to unpin)"
                                    aria-label={`Unpin ${repo.name}`}
                                    className="text-[var(--color-mint-accent,#B9E4D0)] hover:text-[var(--color-muted)] transition-colors p-0.5 cursor-pointer inline-flex items-center"
                                  >
                                    <MaterialIcon name="push_pin" size={13} fill={1} color="var(--color-mint-accent,#B9E4D0)" aria-hidden="true" />
                                  </button>
                                )}
                                {repo.is_private ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-[var(--color-muted)] bg-[var(--color-raised)] border border-[var(--color-border)] ml-1">
                                    <MaterialIcon name="lock" size={11} aria-label="Private repository" />
                                    <span>Private</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-[var(--color-muted)] bg-[var(--color-raised)] border border-[var(--color-border)] ml-1">
                                    <MaterialIcon name="public" size={11} aria-label="Public repository" />
                                    <span>Public</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* 2. Branch & Commit */}
                        <TableCell className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-[var(--color-text-secondary)]">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[var(--color-text)] px-1.5 py-0.5 rounded bg-[var(--color-raised)]/60 border border-[var(--color-border)]">
                              <MaterialIcon name="call_split" size={13} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                              <span>main</span>
                            </span>

                            {activeSha && (
                              <span className="inline-flex items-center gap-1 text-[var(--color-muted)] px-1.5 py-0.5 rounded bg-[var(--color-raised)]/60 border border-[var(--color-border)]">
                                <MaterialIcon name="commit" size={13} aria-hidden="true" />
                                <span>{shortSha(activeSha)}</span>
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* 3. Verification State */}
                        <TableCell className="py-3.5 px-4 whitespace-nowrap">
                          <RepositoryStatusCell
                            status={repo.latest_job_status}
                            shortSha={repo.active_version_short_sha}
                            failureCode={repo.latest_job_failure_code}
                            onIndex={() => triggerIndex(repo.id)}
                            onRetry={() => triggerIndex(repo.id)}
                          />
                        </TableCell>

                        {/* 4. Last Indexed */}
                        <TableCell className="py-3.5 px-4 whitespace-nowrap text-[var(--color-muted)] font-mono text-xs">
                          {repo.latest_job_status &&
                          ['QUEUED', 'FETCHING', 'INDEXING', 'ANALYZING'].includes(repo.latest_job_status) ? (
                            <span className="text-[var(--color-warning)] inline-flex items-center gap-1">
                              <MaterialIcon name="sync" size={14} spin aria-hidden="true" />
                              <span>In progress...</span>
                            </span>
                          ) : repo.last_indexed_at ? (
                            <span className="inline-flex items-center gap-1">
                              <MaterialIcon name="schedule" size={13} className="text-[var(--color-muted)]" aria-hidden="true" />
                              <span>{formatRelativeTime(repo.last_indexed_at)}</span>
                            </span>
                          ) : (
                            <span className="text-[var(--color-muted)]">Never</span>
                          )}
                        </TableCell>

                        {/* 5. Clear Action to Open Repo + Dropdown (Keydown Bubbling Guarded) */}
                        <TableCell className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div
                            className="inline-flex items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => navigate(`/repositories/${repo.id}`)}
                              className="h-7 px-3 text-xs font-semibold gap-1.5 text-[var(--color-text)] hover:text-[var(--color-mint-accent,#B9E4D0)] hover:border-[var(--color-mint-accent,#B9E4D0)]/40 hover:bg-[var(--color-mint-selected-bg,#1B332A)] transition-all cursor-pointer"
                              aria-label={`Open repository ${repo.name}`}
                            >
                              <span>Open</span>
                              <MaterialIcon name="arrow_forward" size={13} aria-hidden="true" />
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  title="Repository options"
                                  aria-label={`Options for ${repo.name}`}
                                  className="h-7 w-7 text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)] transition cursor-pointer"
                                >
                                  <MaterialIcon name="more_vert" size={16} aria-hidden="true" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem
                                  onClick={() => {
                                    const willPin = !isPinned(repo.id);
                                    togglePin(repo.id);
                                    if (willPin) {
                                      toast.success(`Pinned ${repo.owner}/${repo.name} to sidebar`);
                                    } else {
                                      toast(`Unpinned ${repo.owner}/${repo.name}`);
                                    }
                                  }}
                                  className="cursor-pointer gap-2 text-xs"
                                >
                                  <MaterialIcon
                                    name="push_pin"
                                    size={16}
                                    fill={isPinned(repo.id) ? 1 : 0}
                                    color={isPinned(repo.id) ? 'var(--color-mint-accent,#B9E4D0)' : 'var(--color-muted)'}
                                    aria-hidden="true"
                                  />
                                  <span>{isPinned(repo.id) ? 'Unpin from sidebar' : 'Pin to sidebar'}</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={async () => {
                                    try {
                                      await triggerIndex(repo.id);
                                      toast.success(`Indexing started for ${repo.name}`);
                                    } catch (err: unknown) {
                                      toast.error(err instanceof Error ? err.message : 'Failed to trigger index');
                                    }
                                  }}
                                  className="cursor-pointer gap-2 text-xs"
                                >
                                  <MaterialIcon name="sync" size={16} color="var(--color-mint-accent,#B9E4D0)" aria-hidden="true" />
                                  <span>Re-index repository</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => navigate(`/repositories/${repo.id}/chat`)}
                                  className="cursor-pointer gap-2 text-xs"
                                >
                                  <MaterialIcon name="chat" size={16} color="var(--color-mint-accent,#B9E4D0)" aria-hidden="true" />
                                  <span>AI Chat</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => navigate(`/repositories/${repo.id}/architecture`)}
                                  className="cursor-pointer gap-2 text-xs"
                                >
                                  <MaterialIcon name="account_tree" size={16} color="var(--color-mint-accent,#B9E4D0)" aria-hidden="true" />
                                  <span>Architecture Graph</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => window.open(`https://github.com/${repo.owner}/${repo.name}`, '_blank')}
                                  className="cursor-pointer gap-2 text-xs"
                                >
                                  <MaterialIcon name="open_in_new" size={16} aria-hidden="true" />
                                  <span>View on GitHub</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setRepoToDelete(repo)}
                                  destructive
                                  className="cursor-pointer gap-2 text-xs text-[var(--color-error)] focus:text-[var(--color-error)]"
                                >
                                  <MaterialIcon name="delete" size={16} aria-hidden="true" />
                                  <span>Delete repository</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      )}



      {/* Connect Repository Drawer */}
      <ConnectDrawer
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnected={refetch}
      />

      {/* Delete Repository Confirmation Dialog */}
      <Dialog open={!!repoToDelete} onOpenChange={(open) => !open && !isDeleting && setRepoToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--color-error)]">
              <MaterialIcon name="warning" size={22} fill={1} className="text-[var(--color-error)]" aria-hidden="true" />
              <span>Delete repository?</span>
            </DialogTitle>
            <DialogDescription className="pt-1.5 text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-[var(--color-text)] font-mono">
                {repoToDelete?.owner}/{repoToDelete?.name}
              </span>
              ? This will remove the repository from your workspace and hide its indexed data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRepoToDelete(null)}
              disabled={isDeleting}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={async () => {
                if (!repoToDelete) return;
                try {
                  setIsDeleting(true);
                  await deleteRepository(repoToDelete.id);
                  setRepoToDelete(null);
                } catch {
                  // Handled by polling error or boundary
                } finally {
                  setIsDeleting(false);
                }
              }}
              className="gap-1.5 cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <MaterialIcon name="sync" size={16} spin aria-hidden="true" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <MaterialIcon name="delete" size={16} aria-hidden="true" />
                  <span>Delete repository</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
