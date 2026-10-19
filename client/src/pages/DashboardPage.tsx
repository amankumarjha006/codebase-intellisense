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
  Terminal,
  Trash2,
  AlertTriangle,
  Loader2,
  Cpu,
  Layers,
} from 'lucide-react';
import { ApiError, RepositoryListItemOut } from '../lib/api';
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

export function DashboardPage() {
  const navigate = useNavigate();
  const { markSessionExpired } = useAuth();
  const [searchInput, setSearchInput] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
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
    <AnimatedPage className="p-6 max-w-7xl mx-auto space-y-6">
      <LiveRegion message={a11yAnnouncement} />

      {/* Top Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-text)]">
            Dashboard
          </h1>
          {!loading && !error && (
            <span
              className="text-xs sm:text-sm text-[var(--color-muted)] font-mono"
              aria-label={`${total} total repositories`}
            >
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
            aria-label="Synchronize repository states"
            title="Synchronize repository states"
          >
            <RefreshCw size={13} className={loading || isPolling ? 'animate-spin' : ''} aria-hidden="true" />
            <span className="hidden sm:inline">Sync</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setConnectOpen(true)}
            aria-label="Connect new repository"
          >
            <Plus size={15} aria-hidden="true" />
            <span>Connect Repository</span>
          </Button>
        </div>
      </header>

      {/* Filter & Metrics Bar */}
      {(!error || repositories.length > 0) && (
        <section
          aria-label="Repository search and metrics overview"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-2.5 text-[var(--color-muted)]" aria-hidden="true" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Filter by name or owner..."
              aria-label="Filter repositories by name or owner"
              className="pl-8 pr-10 text-xs h-9 bg-[var(--color-surface)] border-[var(--color-border)]"
            />
            <kbd
              aria-hidden="true"
              className="absolute right-2.5 top-2.5 hidden sm:inline-flex items-center gap-0.5 rounded border border-[var(--color-border)] bg-[var(--color-raised)] px-1.5 text-[10px] font-mono text-[var(--color-muted)]"
            >
              ⌘K
            </kbd>
          </div>

          {!loading && repositories.length > 0 && (
            <div className="flex items-center gap-2" role="group" aria-label="Repository status counts">
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] font-mono"
                title={`${readyCount} repositories indexed and ready`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" aria-hidden="true" />
                <span className="font-semibold text-[var(--color-text)]">{readyCount}</span>
                <span>Indexed</span>
              </div>
              {activeCount > 0 && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-warning-tint)] border border-[rgba(251,191,36,0.3)] text-xs text-[var(--color-warning)] font-mono"
                  title={`${activeCount} indexing jobs currently active`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-warning)] animate-pulse" aria-hidden="true" />
                  <span className="font-semibold">{activeCount}</span>
                  <span>Active</span>
                </div>
              )}
              {alertCount > 0 && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-error-tint)] border border-[var(--color-error-border)] text-xs text-[var(--color-error)] font-mono"
                  title={`${alertCount} repositories require attention`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-error)]" aria-hidden="true" />
                  <span className="font-semibold">{alertCount}</span>
                  <span>Alert</span>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Loading Skeleton State */}
      {loading && (
        <div
          role="status"
          aria-label="Loading repository list"
          className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm"
        >
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
                  aria-label="Copy diagnostic reference id"
                >
                  {copiedRequestId ? (
                    <Check size={12} className="text-[var(--color-accent)]" aria-hidden="true" />
                  ) : (
                    <Copy size={12} aria-hidden="true" />
                  )}
                </button>
              </div>
            )}

            <div className="pt-2 flex items-center justify-center gap-3">
              <Button variant="primary" size="sm" onClick={refetch}>
                <RefreshCw size={13} aria-hidden="true" />
                <span>Retry connection</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State: First Sign-In */}
      {!loading && !error && repositories.length === 0 && (
        <section
          role="status"
          aria-label="No repositories connected"
          className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 sm:p-12 text-center space-y-6 max-w-2xl mx-auto mt-6 shadow-sm"
        >
          <div
            className="h-14 w-14 rounded-2xl bg-[var(--color-raised)] border border-[var(--color-border-strong)] flex items-center justify-center text-[var(--color-accent)] mx-auto"
            aria-hidden="true"
          >
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
            <Button
              variant="primary"
              onClick={() => setConnectOpen(true)}
              aria-label="Connect your first repository"
            >
              <Plus size={15} aria-hidden="true" />
              <span>Connect repository</span>
            </Button>
          </div>

          <p className="text-[11px] text-[var(--color-muted)] flex items-center justify-center gap-1.5 font-mono">
            <Lock size={11} aria-hidden="true" />
            <span>Zero-retention ephemeral memory · Static AST analysis only</span>
          </p>

          {/* Three Feature Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[var(--color-border)] text-left">
            <div className="p-3 rounded-[var(--radius-control)] bg-[var(--color-raised)]/40 border border-[var(--color-border)]/50 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase text-[var(--color-muted)]">
                <Cpu size={12} className="text-[var(--color-accent)]" aria-hidden="true" />
                <span>AST Resolution</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-normal">
                Generates strict semantic citation anchors instead of approximate text matching.
              </p>
            </div>

            <div className="p-3 rounded-[var(--radius-control)] bg-[var(--color-raised)]/40 border border-[var(--color-border)]/50 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase text-[var(--color-muted)]">
                <Terminal size={12} className="text-[var(--color-accent)]" aria-hidden="true" />
                <span>Evidence Auditing</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-normal">
                Every code query returns verifiable line-anchored coordinates directly from the repository tree.
              </p>
            </div>

            <div className="p-3 rounded-[var(--radius-control)] bg-[var(--color-raised)]/40 border border-[var(--color-border)]/50 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase text-[var(--color-muted)]">
                <Layers size={12} className="text-[var(--color-accent)]" aria-hidden="true" />
                <span>Local Runtime</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-normal">
                Designed to interface directly with local language servers and CI/CD pipelines.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Populated Table */}
      {!loading && !error && repositories.length > 0 && (
        <section aria-label="Repositories list" className="space-y-4">
          <div className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm">
            <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
              <table
                className="w-full text-left text-xs border-collapse"
                aria-label="Connected repositories"
              >
                <thead className="sticky top-0 bg-[var(--color-surface)] z-10 border-b border-[var(--color-border)] shadow-xs">
                  <tr className="bg-[var(--color-raised)] text-[var(--color-muted)] font-medium">
                    <th scope="col" className="py-3 px-4">REPOSITORY</th>
                    <th scope="col" className="py-3 px-4">BRANCH & COMMIT</th>
                    <th scope="col" className="py-3 px-4">VERIFICATION STATUS</th>
                    <th scope="col" className="py-3 px-4">LAST INDEXED</th>
                    <th scope="col" className="py-3 px-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {repositories.map((repo) => (
                    <tr
                      key={repo.id}
                      onClick={() => navigate(`/repositories/${repo.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/repositories/${repo.id}`);
                        }
                      }}
                      tabIndex={0}
                      role="row"
                      aria-label={`${repo.owner}/${repo.name}, status ${repo.latest_job_status || 'not indexed'}`}
                      className="hover:bg-[var(--color-raised)]/60 cursor-pointer transition-colors group focus:outline-hidden focus:bg-[var(--color-raised)]"
                    >
                      {/* Repository Name & Owner */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-8 w-8 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)] shrink-0 transition-transform group-hover:scale-105"
                            aria-hidden="true"
                          >
                            <GitBranch size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-semibold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                              <span className="text-[var(--color-muted)] font-normal">{repo.owner}/</span>
                              <span>{repo.name}</span>
                              {repo.is_private ? (
                                <Lock
                                  size={11}
                                  className="text-[var(--color-muted)] ml-0.5"
                                  aria-label="Private repository"
                                />
                              ) : (
                                <Globe
                                  size={11}
                                  className="text-[var(--color-muted)] ml-0.5"
                                  aria-label="Public repository"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Branch & Commit */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-[var(--color-text-secondary)]">
                        {repo.active_version_short_sha ? (
                          <div className="flex items-center gap-1.5">
                            <GitBranch size={12} className="text-[var(--color-muted)]" aria-hidden="true" />
                            <span>main · {repo.active_version_short_sha}</span>
                          </div>
                        ) : (
                          <span className="text-[var(--color-muted)]" aria-label="No commit indexed">-</span>
                        )}
                      </td>

                      {/* Verification Status */}
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
                            aria-label={`Open repository ${repo.name}`}
                          >
                            <ExternalLink size={14} aria-hidden="true" />
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Repository actions"
                                aria-label={`Actions for ${repo.name}`}
                              >
                                <MoreVertical size={14} aria-hidden="true" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                onClick={() => triggerIndex(repo.id)}
                                className="cursor-pointer gap-2 text-xs"
                              >
                                <RefreshCw size={13} className="text-[var(--color-accent)]" aria-hidden="true" />
                                <span>Re-index repo</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setRepoToDelete(repo)}
                                destructive
                                className="cursor-pointer gap-2 text-xs text-[var(--color-error)] focus:text-[var(--color-error)]"
                              >
                                <Trash2 size={13} aria-hidden="true" />
                                <span>Delete</span>
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
              <AlertTriangle size={18} aria-hidden="true" />
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
                  <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 size={13} aria-hidden="true" />
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
