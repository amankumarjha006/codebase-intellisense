import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitBranch,
  Search,
  Plus,
  RefreshCw,
  ExternalLink,
  Lock,
  Globe,
  MoreVertical,
  WifiOff,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Terminal,
} from 'lucide-react';
import { ApiError } from '../lib/api';
import { formatRelativeTime } from '../lib/utils';
import { RepositoryStatusCell } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { ConnectDrawer } from '../components/repository/ConnectDrawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { useRepositoryPolling } from '../lib/useRepositoryPolling';

export function DashboardPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [connectOpen, setConnectOpen] = React.useState(false);
  const [copiedRequestId, setCopiedRequestId] = React.useState(false);

  // Debounce search input by 300ms
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const {
    repositories,
    total,
    limit,
    loading,
    isPolling,
    error,
    refetch,
    triggerIndex,
  } = useRepositoryPolling({
    page,
    limit: 20,
    search: debouncedSearch,
    onSessionExpired: () => navigate('/status/session-expired', { replace: true }),
  });

  // Calculate metrics counts
  const readyCount = repositories.filter(
    (r) => r.latest_job_status === 'READY' || (r.active_version_short_sha && !r.latest_job_status)
  ).length;
  const activeCount = repositories.filter(
    (r) =>
      r.latest_job_status === 'QUEUED' ||
      r.latest_job_status === 'FETCHING' ||
      r.latest_job_status === 'INDEXING' ||
      r.latest_job_status === 'ANALYZING'
  ).length;
  const alertCount = repositories.filter(
    (r) => r.latest_job_status === 'FAILED'
  ).length;

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  const handleCopyRequestId = (reqId: string) => {
    navigator.clipboard.writeText(reqId);
    setCopiedRequestId(true);
    setTimeout(() => setCopiedRequestId(false), 2000);
  };

  const requestId = error instanceof ApiError ? error.requestId : null;
  const httpStatus = error instanceof ApiError ? error.status : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-text)]">
            Dashboard
          </h1>
          {!loading && !error && (
            <span className="text-xs sm:text-sm text-[var(--color-muted)] font-mono">
              {total} {total === 1 ? 'repository' : 'repositories'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={refetch}
            disabled={loading}
            title="Synchronize repository states"
          >
            <RefreshCw size={13} className={loading || isPolling ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Sync</span>
          </Button>

          <Button variant="primary" size="sm" onClick={() => setConnectOpen(true)}>
            <Plus size={15} />
            <span>Connect Repository</span>
          </Button>
        </div>
      </div>

      {/* Filter & Metrics Bar */}
      {(!error || repositories.length > 0) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-2.5 text-[var(--color-muted)]" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Filter by name or owner..."
              className="pl-8 pr-10 text-xs h-9 bg-[var(--color-surface)] border-[var(--color-border)]"
            />
            <kbd className="absolute right-2.5 top-2.5 hidden sm:inline-flex items-center gap-0.5 rounded border border-[var(--color-border)] bg-[var(--color-raised)] px-1.5 text-[10px] font-mono text-[var(--color-muted)]">
              ⌘K
            </kbd>
          </div>

          {!loading && repositories.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                <span className="font-semibold text-[var(--color-text)]">{readyCount}</span>
                <span>Indexed</span>
              </div>
              {activeCount > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-warning-tint)] border border-[rgba(251,191,36,0.3)] text-xs text-[var(--color-warning)] font-mono">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-warning)] animate-pulse" />
                  <span className="font-semibold">{activeCount}</span>
                  <span>Active</span>
                </div>
              )}
              {alertCount > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-error-tint)] border border-[var(--color-error-border)] text-xs text-[var(--color-error)] font-mono">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-error)]" />
                  <span className="font-semibold">{alertCount}</span>
                  <span>Alert</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Loading Skeleton State */}
      {loading && (
        <div className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between py-3 border-b border-[var(--color-border)]/50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error State (Matching dashboard_error.png design) */}
      {!loading && error && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-error)]">
            <span className="h-2 w-2 rounded-full bg-[var(--color-error)] animate-pulse" />
            <span>
              Cluster Unreachable {httpStatus ? `(HTTP ${httpStatus})` : ''}
            </span>
          </div>

          <div className="rounded-[var(--radius-panel)] border border-[var(--color-error-border)] bg-[var(--color-surface)] p-8 text-center space-y-5 max-w-2xl mx-auto shadow-sm">
            <div className="h-12 w-12 rounded-full bg-[var(--color-error-tint)] border border-[var(--color-error-border)] flex items-center justify-center text-[var(--color-error)] mx-auto">
              <WifiOff size={22} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                Can't reach the server.
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-md mx-auto leading-relaxed">
                The request timed out while loading the repository list from the index cluster. Verification index pipelines may be undergoing maintenance or unreachable from your region.
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
                >
                  {copiedRequestId ? <Check size={12} className="text-[var(--color-accent)]" /> : <Copy size={12} />}
                </button>
              </div>
            )}

            <div className="pt-2 flex items-center justify-center gap-3">
              <Button variant="primary" size="sm" onClick={refetch}>
                <RefreshCw size={13} />
                <span>Retry connection</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State: First Sign-In (Matching dashboard_empty_first_sign_in.png design) */}
      {!loading && !error && repositories.length === 0 && (
        <div className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 sm:p-12 text-center space-y-6 max-w-2xl mx-auto mt-6 shadow-sm">
          <div className="h-14 w-14 rounded-2xl bg-[var(--color-raised)] border border-[var(--color-border-strong)] flex items-center justify-center text-[var(--color-accent)] mx-auto">
            <Terminal size={26} />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-lg font-bold tracking-tight text-[var(--color-text)]">
              Connect your first repository
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Sync your private or public GitHub repositories to inspect and query AST-grounded code with verified citations.
            </p>
          </div>

          <div className="pt-1">
            <Button variant="primary" onClick={() => setConnectOpen(true)}>
              <Plus size={15} />
              <span>Connect repository</span>
            </Button>
          </div>

          <p className="text-[11px] text-[var(--color-muted)] flex items-center justify-center gap-1.5 font-mono">
            <Lock size={11} />
            <span>Zero-retention ephemeral memory · Static AST analysis only</span>
          </p>

          {/* Three Feature Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[var(--color-border)] text-left">
            <div className="p-3 rounded-[var(--radius-control)] bg-[var(--color-raised)]/40 border border-[var(--color-border)]/50 space-y-1">
              <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--color-muted)]">
                AST Resolution
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-normal">
                Generates strict semantic citation anchors instead of approximate text matching.
              </p>
            </div>

            <div className="p-3 rounded-[var(--radius-control)] bg-[var(--color-raised)]/40 border border-[var(--color-border)]/50 space-y-1">
              <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--color-muted)]">
                Evidence Auditing
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-normal">
                Every code query returns verifiable line-anchored coordinates directly from the repository tree.
              </p>
            </div>

            <div className="p-3 rounded-[var(--radius-control)] bg-[var(--color-raised)]/40 border border-[var(--color-border)]/50 space-y-1">
              <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--color-muted)]">
                Local Runtime
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-normal">
                Designed to interface directly with local language servers and CI/CD pipelines.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Populated Table (Matching dashboard_populated.png design) */}
      {!loading && !error && repositories.length > 0 && (
        <div className="space-y-4">
          <div className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-raised)]/40 text-[var(--color-muted)] font-medium">
                    <th className="py-3 px-4">REPOSITORY</th>
                    <th className="py-3 px-4">BRANCH & COMMIT</th>
                    <th className="py-3 px-4">VERIFICATION STATUS</th>
                    <th className="py-3 px-4">LAST INDEXED</th>
                    <th className="py-3 px-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {repositories.map((repo) => (
                    <tr
                      key={repo.id}
                      onClick={() => navigate(`/repositories/${repo.id}`)}
                      className="hover:bg-[var(--color-raised)]/50 cursor-pointer transition-colors group"
                    >
                      {/* Repository Name & Owner */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)] shrink-0">
                            <GitBranch size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-semibold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                              <span className="text-[var(--color-muted)] font-normal">{repo.owner}/</span>
                              <span>{repo.name}</span>
                              {repo.is_private ? (
                                <Lock size={11} className="text-[var(--color-muted)] ml-0.5" />
                              ) : (
                                <Globe size={11} className="text-[var(--color-muted)] ml-0.5" />
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Branch & Commit */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-[var(--color-text-secondary)]">
                        {repo.active_version_short_sha ? (
                          <div className="flex items-center gap-1.5">
                            <GitBranch size={12} className="text-[var(--color-muted)]" />
                            <span>main · {repo.active_version_short_sha}</span>
                          </div>
                        ) : (
                          <span className="text-[var(--color-muted)]">-</span>
                        )}
                      </td>

                      {/* Verification Status (via deriveRowStatus) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <RepositoryStatusCell
                          status={repo.latest_job_status}
                          shortSha={repo.active_version_short_sha}
                          failureCode={repo.latest_job_failure_code}
                          onIndex={() => triggerIndex(repo.id)}
                          onRetry={() => triggerIndex(repo.id)}
                        />
                      </td>

                      {/* Last Indexed */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-[var(--color-muted)] font-mono text-[11px]">
                        {repo.latest_job_status && ['QUEUED', 'FETCHING', 'INDEXING', 'ANALYZING'].includes(repo.latest_job_status) ? (
                          <span className="text-[var(--color-warning)]">In progress...</span>
                        ) : repo.last_indexed_at ? (
                          formatRelativeTime(repo.last_indexed_at)
                        ) : (
                          'Never'
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div
                          className="inline-flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => navigate(`/repositories/${repo.id}`)}
                            title="Open repository"
                          >
                            <ExternalLink size={14} />
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm">
                                <MoreVertical size={14} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/repositories/${repo.id}`)}>
                                Overview
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/repositories/${repo.id}/chat`)}>
                                Start Chat
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/repositories/${repo.id}/architecture`)}>
                                Architecture
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/repositories/${repo.id}/search`)}>
                                Search Code
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/repositories/${repo.id}/files`)}>
                                Browse Files
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[var(--color-muted)]">
            <div>
              Showing <span className="font-semibold text-[var(--color-text)]">{startItem}–{endItem}</span> of{' '}
              <span className="font-semibold text-[var(--color-text)]">{total}</span> repositories
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft size={13} />
                <span>Previous</span>
              </Button>

              <span className="px-2 py-1 font-mono text-[11px] text-[var(--color-text)]">
                {page} / {totalPages}
              </span>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <span>Next</span>
                <ChevronRight size={13} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Connect Repository Drawer */}
      <ConnectDrawer
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnected={refetch}
      />
    </div>
  );
}
