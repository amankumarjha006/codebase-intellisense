import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { ApiError, RepositoryListItemOut } from '../lib/api';
import { formatNumber, formatRelativeTime, shortSha } from '../lib/utils';
import { RepositoryStatusCell, StatusChip } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
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

type StatusFilter = 'ALL' | 'READY' | 'ACTIVE' | 'FAILED';

export function DashboardPage() {
  const navigate = useNavigate();
  const { markSessionExpired } = useAuth();
  const [searchInput, setSearchInput] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('ALL');
  const [connectOpen, setConnectOpen] = React.useState(false);
  const [copiedRequestId, setCopiedRequestId] = React.useState(false);
  const [repoToDelete, setRepoToDelete] = React.useState<RepositoryListItemOut | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [a11yAnnouncement, setA11yAnnouncement] = React.useState('');

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

  // Calculate honest metrics supplied by backend
  const readyCount = React.useMemo(() => {
    return repositories.filter(
      (r) => r.latest_job_status === 'READY' || (r.active_version_short_sha && !r.latest_job_status)
    ).length;
  }, [repositories]);

  const activeCount = React.useMemo(() => {
    return repositories.filter((r) =>
      ['QUEUED', 'FETCHING', 'INDEXING', 'ANALYZING'].includes(r.latest_job_status || '')
    ).length;
  }, [repositories]);

  const alertCount = React.useMemo(() => {
    return repositories.filter((r) => r.latest_job_status === 'FAILED').length;
  }, [repositories]);



  // Most recent indexing activity timestamp & repo
  const mostRecentSync = React.useMemo(() => {
    const sorted = [...repositories]
      .filter((r) => r.last_indexed_at)
      .sort((a, b) => new Date(b.last_indexed_at!).getTime() - new Date(a.last_indexed_at!).getTime());
    return sorted[0] || null;
  }, [repositories]);

  // Filter repositories based on statusFilter
  const filteredRepositories = React.useMemo(() => {
    if (statusFilter === 'ALL') return repositories;
    if (statusFilter === 'READY') {
      return repositories.filter(
        (r) => r.latest_job_status === 'READY' || (r.active_version_short_sha && !r.latest_job_status)
      );
    }
    if (statusFilter === 'ACTIVE') {
      return repositories.filter((r) =>
        ['QUEUED', 'FETCHING', 'INDEXING', 'ANALYZING'].includes(r.latest_job_status || '')
      );
    }
    if (statusFilter === 'FAILED') {
      return repositories.filter((r) => r.latest_job_status === 'FAILED');
    }
    return repositories;
  }, [repositories, statusFilter]);

  // Construct real recent activity events from actual repository data
  const recentActivities = React.useMemo(() => {
    const events: Array<{
      id: string;
      repoId: string;
      repoName: string;
      owner: string;
      type: 'INDEXED' | 'INDEXING' | 'FAILED' | 'CONNECTED';
      timestamp: string;
      sha?: string | null;
      failureCode?: string | null;
    }> = [];

    repositories.forEach((repo) => {
      if (repo.latest_job_status === 'INDEXING' || repo.latest_job_status === 'QUEUED') {
        events.push({
          id: `${repo.id}-indexing`,
          repoId: repo.id,
          repoName: repo.name,
          owner: repo.owner,
          type: 'INDEXING',
          timestamp: repo.created_at,
          sha: repo.active_version_short_sha,
        });
      } else if (repo.latest_job_status === 'FAILED') {
        events.push({
          id: `${repo.id}-failed`,
          repoId: repo.id,
          repoName: repo.name,
          owner: repo.owner,
          type: 'FAILED',
          timestamp: repo.last_indexed_at || repo.created_at,
          failureCode: repo.latest_job_failure_code,
        });
      } else if (repo.last_indexed_at) {
        events.push({
          id: `${repo.id}-indexed`,
          repoId: repo.id,
          repoName: repo.name,
          owner: repo.owner,
          type: 'INDEXED',
          timestamp: repo.last_indexed_at,
          sha: repo.active_version_short_sha,
        });
      } else if (repo.created_at) {
        events.push({
          id: `${repo.id}-connected`,
          repoId: repo.id,
          repoName: repo.name,
          owner: repo.owner,
          type: 'CONNECTED',
          timestamp: repo.created_at,
        });
      }
    });

    return events
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  }, [repositories]);

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
    <AnimatedPage className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-7">
      <LiveRegion message={a11yAnnouncement} />

      {/* Page Heading & Primary Action */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[var(--color-border)]/50">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-text)]">
              Repositories
            </h1>
            {!loading && !error && repositories.length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-[var(--color-raised)] text-[var(--color-mint-accent,#B9E4D0)] border border-[rgba(185,228,208,0.22)]">
                {total} {total === 1 ? 'codebase' : 'codebases'}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] max-w-2xl">
            Manage connected GitHub repositories, verify AST symbol indices, and query semantic codebase intelligence.
          </p>
        </div>

        {/* Single Prominent Connect Repository Action + Sync */}
        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={refetch}
            disabled={loading}
            aria-label="Synchronize repository states"
            title="Synchronize repository states"
            className="h-9 px-3"
          >
            <MaterialIcon name="sync" size={18} spin={loading || isPolling} aria-hidden="true" />
            <span className="hidden sm:inline">Sync</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setConnectOpen(true)}
            aria-label="Connect new repository"
            className="h-9 px-3.5 font-medium shadow-sm hover:shadow transition"
          >
            <MaterialIcon name="add" size={18} aria-hidden="true" />
            <span>Connect Repository</span>
          </Button>
        </div>
      </header>

      {/* Summary Metrics: Compact shadcn Cards (Only shown when user has repositories) */}
      {!loading && !error && repositories.length > 0 && (
        <section aria-label="Repository metrics overview">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Connected Repositories */}
            <Card className="bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                  Connected Repositories
                </CardDescription>
                <div className="h-8 w-8 rounded-lg bg-[var(--color-raised)] flex items-center justify-center text-[var(--color-mint-accent,#B9E4D0)]">
                  <MaterialIcon name="folder" size={18} fill={1} color="var(--color-mint-accent, #B9E4D0)" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-1">
                <div className="text-2xl font-bold font-mono text-[var(--color-text)]">
                  {total}
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  Aggregated across your workspace
                </p>
              </CardContent>
            </Card>

            {/* 2. Indexed & Ready */}
            <Card className="bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                  Ready & Searchable
                </CardDescription>
                <div className="h-8 w-8 rounded-lg bg-[var(--color-raised)] flex items-center justify-center text-[var(--color-mint-accent,#B9E4D0)]">
                  <MaterialIcon name="check_circle" size={18} fill={1} color="var(--color-mint-accent, #B9E4D0)" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-1">
                <div className="text-2xl font-bold font-mono text-[var(--color-mint-accent,#B9E4D0)]">
                  {readyCount}
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  Active AST symbol vectors verified
                </p>
              </CardContent>
            </Card>

            {/* 3. Active Pipelines */}
            <Card className="bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                  Active Indexing
                </CardDescription>
                <div className="h-8 w-8 rounded-lg bg-[var(--color-raised)] flex items-center justify-center text-[var(--color-warning)]">
                  <MaterialIcon
                    name="sync"
                    size={18}
                    spin={activeCount > 0}
                    color={activeCount > 0 ? 'var(--color-warning)' : 'var(--color-muted)'}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-1">
                <div className="text-2xl font-bold font-mono text-[var(--color-text)]">
                  {activeCount}
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  {activeCount > 0 ? 'Parsing AST or generating embeddings' : 'All indexing jobs completed'}
                </p>
              </CardContent>
            </Card>

            {/* 4. Recent Synchronization Activity */}
            <Card className="bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                  Latest Activity
                </CardDescription>
                <div className="h-8 w-8 rounded-lg bg-[var(--color-raised)] flex items-center justify-center text-[var(--color-mint-accent,#B9E4D0)]">
                  <MaterialIcon
                    name="schedule"
                    size={18}
                    fill={1}
                    color="var(--color-mint-accent, #B9E4D0)"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-1">
                <div className="text-2xl font-bold font-mono text-[var(--color-text)] truncate">
                  {mostRecentSync?.last_indexed_at
                    ? formatRelativeTime(mostRecentSync.last_indexed_at)
                    : 'Up to date'}
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
                  {mostRecentSync
                    ? `Recent: ${mostRecentSync.owner}/${mostRecentSync.name}`
                    : 'All repositories synchronized'}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div
          role="status"
          aria-label="Loading repository list"
          className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm p-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-[var(--radius-panel)]" />
            ))}
          </div>
          <div className="space-y-3 pt-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div role="alert" aria-live="assertive" className="space-y-6">
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-error)]">
            <span className="h-2 w-2 rounded-full bg-[var(--color-error)] animate-pulse" aria-hidden="true" />
            <span>
              Cluster Unreachable {httpStatus ? `(HTTP ${httpStatus})` : ''}
            </span>
          </div>

          <div className="rounded-[var(--radius-panel)] border border-[var(--color-error-border)] bg-[var(--color-surface)] p-8 text-center space-y-5 max-w-2xl mx-auto shadow-sm">
            <div
              className="h-12 w-12 rounded-full bg-[var(--color-error-tint)] border border-[var(--color-error-border)] flex items-center justify-center text-[var(--color-error)] mx-auto"
              aria-hidden="true"
            >
              <MaterialIcon name="wifi_off" size={24} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                Can't reach the server.
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-md mx-auto leading-relaxed">
                The request timed out while loading repository records from the backend. The database or indexing workers may be restarting.
              </p>
            </div>

            {requestId && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-control)] bg-[var(--color-raised)] border border-[var(--color-border)] text-xs font-mono text-[var(--color-muted)]">
                <span>DIAGNOSTIC TRACE</span>
                <span className="text-[var(--color-text)]">Reference: {requestId}</span>
                <button
                  type="button"
                  onClick={() => handleCopyRequestId(requestId)}
                  className="p-1 hover:text-[var(--color-text)] transition rounded"
                  title="Copy reference id"
                  aria-label="Copy diagnostic reference id"
                >
                  {copiedRequestId ? (
                    <MaterialIcon name="check" size={16} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                  ) : (
                    <MaterialIcon name="content_copy" size={16} aria-hidden="true" />
                  )}
                </button>
              </div>
            )}

            <div className="pt-2 flex items-center justify-center gap-3">
              <Button variant="primary" size="sm" onClick={refetch}>
                <MaterialIcon name="sync" size={18} aria-hidden="true" />
                <span>Retry connection</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Meaningful Empty State: 0 Repositories Connected */}
      {!loading && !error && repositories.length === 0 && (
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
            <h2 className="text-lg font-bold tracking-tight text-[var(--color-text)]">
              Connect your first repository
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Sync your private or public GitHub repositories to parse AST code structure, inspect architectural dependencies, and query grounded Q&A.
            </p>
          </div>

          <div className="pt-1">
            <Button
              variant="primary"
              onClick={() => setConnectOpen(true)}
              aria-label="Connect your first repository"
              className="gap-2 px-5 py-2"
            >
              <MaterialIcon name="add" size={18} aria-hidden="true" />
              <span>Connect repository</span>
            </Button>
          </div>

          {/* Three Feature Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-[var(--color-border)] text-left">
            <div className="p-3.5 rounded-[var(--radius-control)] bg-[var(--color-raised)]/40 border border-[var(--color-border)]/50 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-[var(--color-muted)]">
                <MaterialIcon name="memory" size={16} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                <span>AST Resolution</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-normal">
                Parses syntax trees to extract functions, classes, and architectural calls with line-level citations.
              </p>
            </div>

            <div className="p-3.5 rounded-[var(--radius-control)] bg-[var(--color-raised)]/40 border border-[var(--color-border)]/50 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-[var(--color-muted)]">
                <MaterialIcon name="terminal" size={16} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                <span>Verified Citations</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-normal">
                Grounded Q&A responses cite verified source code coordinates directly from your repository tree.
              </p>
            </div>

            <div className="p-3.5 rounded-[var(--radius-control)] bg-[var(--color-raised)]/40 border border-[var(--color-border)]/50 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-[var(--color-muted)]">
                <MaterialIcon name="layers" size={16} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                <span>Zero-Retention</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-normal">
                Ephemeral memory security with pgvector indexing tailored for modern developer workflows.
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
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <MaterialIcon
                name="search"
                size={18}
                className="absolute left-3 top-2.5 text-[var(--color-muted)]"
                aria-hidden="true"
              />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search repositories by name or owner..."
                aria-label="Filter repositories by name or owner"
                className="pl-9 pr-10 text-xs h-9 bg-[var(--color-surface)] border-[var(--color-border)] rounded-[var(--radius-control)] focus:border-[var(--color-mint-accent,#B9E4D0)]"
              />
              <kbd
                aria-hidden="true"
                className="absolute right-2.5 top-2.5 hidden sm:inline-flex items-center gap-0.5 rounded border border-[var(--color-border)] bg-[var(--color-raised)] px-1.5 text-[10px] font-mono text-[var(--color-muted)]"
              >
                ⌘K
              </kbd>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label="Filter by status">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-[var(--color-mint-selected-bg,#253A32)] text-[var(--color-mint-accent,#B9E4D0)] border border-[rgba(185,228,208,0.22)] font-semibold'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60'
                }`}
              >
                All ({total})
              </button>

              <button
                onClick={() => setStatusFilter('READY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  statusFilter === 'READY'
                    ? 'bg-[var(--color-mint-selected-bg,#253A32)] text-[var(--color-mint-accent,#B9E4D0)] border border-[rgba(185,228,208,0.22)] font-semibold'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60'
                }`}
              >
                Indexed ({readyCount})
              </button>

              {activeCount > 0 && (
                <button
                  onClick={() => setStatusFilter('ACTIVE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'ACTIVE'
                      ? 'bg-[var(--color-warning-tint)] text-[var(--color-warning)] border border-[rgba(251,191,36,0.3)] font-semibold'
                      : 'text-[var(--color-warning)] hover:bg-[var(--color-raised)]/60'
                  }`}
                >
                  <MaterialIcon name="sync" size={14} spin aria-hidden="true" />
                  <span>Active ({activeCount})</span>
                </button>
              )}

              {alertCount > 0 && (
                <button
                  onClick={() => setStatusFilter('FAILED')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'FAILED'
                      ? 'bg-[var(--color-error-tint)] text-[var(--color-error)] border border-[var(--color-error-border)] font-semibold'
                      : 'text-[var(--color-error)] hover:bg-[var(--color-raised)]/60'
                  }`}
                >
                  <MaterialIcon name="error" size={14} aria-hidden="true" />
                  <span>Failed ({alertCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* Scannable Table */}
          <div className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm">
            <Table aria-label="Connected repositories">
              <TableHeader>
                <TableRow className="bg-[var(--color-raised)]/40 hover:bg-[var(--color-raised)]/40 border-b border-[var(--color-border)]">
                  <TableHead className="py-3 px-4 font-semibold text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
                    Repository
                  </TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
                    Branch & Commit
                  </TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
                    Verification State
                  </TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
                    Last Indexed
                  </TableHead>
                  <TableHead className="py-3 px-4 text-right font-semibold text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-[var(--color-border)]">
                {filteredRepositories.map((repo) => {
                  const activeSha = repo.active_version_short_sha || '';
                  return (
                    <TableRow
                      key={repo.id}
                      onClick={() => navigate(`/repositories/${repo.id}`)}
                      className="cursor-pointer group hover:bg-[var(--color-raised)]/50 transition-colors"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/repositories/${repo.id}`);
                        }
                      }}
                      aria-label={`Open repository ${repo.owner}/${repo.name}`}
                    >
                      {/* 1. Repository Name & Visibility */}
                      <TableCell className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-8 w-8 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-mint-accent,#B9E4D0)] shrink-0 transition-transform group-hover:scale-105"
                            aria-hidden="true"
                          >
                            <MaterialIcon name="folder" size={20} fill={1} color="var(--color-mint-accent, #B9E4D0)" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-semibold text-[var(--color-text)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition-colors">
                              <span className="text-[var(--color-muted)] font-normal">{repo.owner}/</span>
                              <span className="truncate">{repo.name}</span>
                              {repo.is_private ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--color-muted)] ml-1">
                                  <MaterialIcon name="lock" size={13} aria-label="Private repository" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--color-muted)] ml-1">
                                  <MaterialIcon name="public" size={13} aria-label="Public repository" />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* 2. Branch & Commit */}
                      <TableCell className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-[var(--color-text-secondary)]">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-[var(--color-text)]">
                            <MaterialIcon name="call_split" size={14} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                            <span>main</span>
                          </span>

                          {activeSha && (
                            <span className="inline-flex items-center gap-1 text-[var(--color-muted)]">
                              <MaterialIcon name="commit" size={14} aria-hidden="true" />
                              <span>{shortSha(activeSha)}</span>
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* 3. Indexing State */}
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
                      <TableCell className="py-3.5 px-4 whitespace-nowrap text-[var(--color-muted)] font-mono text-[11px]">
                        {repo.latest_job_status &&
                        ['QUEUED', 'FETCHING', 'INDEXING', 'ANALYZING'].includes(repo.latest_job_status) ? (
                          <span className="text-[var(--color-warning)] flex items-center gap-1">
                            <MaterialIcon name="sync" size={14} spin aria-hidden="true" />
                            <span>In progress...</span>
                          </span>
                        ) : repo.last_indexed_at ? (
                          formatRelativeTime(repo.last_indexed_at)
                        ) : (
                          <span className="text-[var(--color-muted)]">Never</span>
                        )}
                      </TableCell>

                      {/* 5. Clear Action to Open Repo + Dropdown */}
                      <TableCell className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div
                          className="inline-flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/repositories/${repo.id}`)}
                            className="h-7 px-2.5 text-xs font-medium gap-1 text-[var(--color-text)] hover:text-[var(--color-mint-accent,#B9E4D0)]"
                            aria-label={`Open repository ${repo.name}`}
                          >
                            <span>Open</span>
                            <MaterialIcon name="arrow_forward" size={14} aria-hidden="true" />
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Repository options"
                                aria-label={`Options for ${repo.name}`}
                                className="h-7 w-7 text-[var(--color-muted)] hover:text-[var(--color-text)]"
                              >
                                <MaterialIcon name="more_vert" size={16} aria-hidden="true" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                onClick={() => triggerIndex(repo.id)}
                                className="cursor-pointer gap-2 text-xs"
                              >
                                <MaterialIcon name="sync" size={16} color="var(--color-mint-accent,#B9E4D0)" aria-hidden="true" />
                                <span>Re-index repo</span>
                              </DropdownMenuItem>
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
                                <span>Delete repo</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Recent Activity Section (Only shown when real events exist) */}
      {!loading && !error && recentActivities.length > 0 && (
        <section aria-labelledby="recent-activity-heading" className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 id="recent-activity-heading" className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Recent Repository Activity
            </h2>
            <span className="text-[11px] font-mono text-[var(--color-muted)]">
              Live event log
            </span>
          </div>

          <div className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 divide-y divide-[var(--color-border)]/60">
            {recentActivities.map((act) => (
              <div
                key={act.id}
                className="py-2.5 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-[var(--color-raised)]/30 rounded transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="shrink-0">
                    {act.type === 'INDEXED' && (
                      <MaterialIcon name="check_circle" size={18} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-label="Completed" />
                    )}
                    {act.type === 'INDEXING' && (
                      <MaterialIcon name="sync" size={18} spin color="var(--color-warning)" aria-label="Indexing" />
                    )}
                    {act.type === 'FAILED' && (
                      <MaterialIcon name="error" size={18} fill={1} color="var(--color-error)" aria-label="Failed" />
                    )}
                    {act.type === 'CONNECTED' && (
                      <MaterialIcon name="add_circle" size={18} color="var(--color-mint-accent, #B9E4D0)" aria-label="Connected" />
                    )}
                  </div>

                  <div className="min-w-0 flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => navigate(`/repositories/${act.repoId}`)}
                      className="font-semibold text-[var(--color-text)] hover:text-[var(--color-mint-accent,#B9E4D0)] transition truncate cursor-pointer text-left"
                    >
                      {act.owner}/{act.repoName}
                    </button>

                    <span className="text-[var(--color-muted)]">·</span>

                    <span className="text-[var(--color-text-secondary)]">
                      {act.type === 'INDEXED' && 'Successfully indexed AST vectors'}
                      {act.type === 'INDEXING' && 'Indexing AST symbols and generating embeddings'}
                      {act.type === 'FAILED' && `Indexing failed: ${act.failureCode || 'Check logs'}`}
                      {act.type === 'CONNECTED' && 'Repository connected to workspace'}
                    </span>

                    {act.sha && (
                      <span className="font-mono text-[10px] text-[var(--color-muted)] px-1.5 py-0.5 rounded bg-[var(--color-raised)] border border-[var(--color-border)]">
                        {shortSha(act.sha)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <span className="text-[11px] font-mono text-[var(--color-muted)]">
                    {formatRelativeTime(act.timestamp)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/repositories/${act.repoId}`)}
                    className="h-6 px-2 text-[11px] text-[var(--color-mint-accent,#B9E4D0)] hover:text-[var(--color-mint-hover,#D0F1E0)]"
                  >
                    View
                  </Button>
                </div>
              </div>
            ))}
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
              ? This will remove the repository from your dashboard and hide its indexed data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRepoToDelete(null)}
              disabled={isDeleting}
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
              className="gap-1.5"
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
