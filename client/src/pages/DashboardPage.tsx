import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitBranch,
  Search,
  Plus,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Lock,
  Globe,
  MoreVertical,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { api } from '../lib/api';
import { RepositoryListItem } from '../lib/types';
import { formatNumber, formatRelativeTime } from '../lib/utils';
import { StatusChip } from '../components/ui/badge';
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

export function DashboardPage() {
  const navigate = useNavigate();
  const [repositories, setRepositories] = React.useState<RepositoryListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [connectOpen, setConnectOpen] = React.useState(false);

  const fetchRepositories = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRepositories();
      setRepositories(data);
    } catch (err: any) {
      setError(err?.message || "Can't reach the server. Please check connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchRepositories();

    // Re-fetch on scenario changes
    const handleScenarioChange = () => {
      fetchRepositories();
    };
    window.addEventListener('scenario-change', handleScenarioChange);
    return () => window.removeEventListener('scenario-change', handleScenarioChange);
  }, [fetchRepositories]);

  const filteredRepositories = repositories.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.language.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Status summaries
  const readyCount = repositories.filter((r) => r.latest_job_status === 'READY').length;
  const indexingCount = repositories.filter(
    (r) => r.latest_job_status === 'INDEXING' || r.latest_job_status === 'QUEUED' || r.latest_job_status === 'FETCHING'
  ).length;
  const failedCount = repositories.filter((r) => r.latest_job_status === 'FAILED').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-text)]">
            Repositories
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-0.5">
            Manage your connected codebases, view indexing health, and query architecture.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="secondary" size="sm" onClick={fetchRepositories} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button variant="primary" size="sm" onClick={() => setConnectOpen(true)}>
            <Plus size={15} />
            <span>Connect repository</span>
          </Button>
        </div>
      </div>

      {/* Summary Status Badges */}
      {!loading && !error && repositories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
            <span className="font-semibold text-[var(--color-text)]">{repositories.length}</span>
            <span>total repositories</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-accent-tint)] border border-[var(--color-accent-border)] text-xs text-[var(--color-accent)]">
            <CheckCircle2 size={12} />
            <span className="font-semibold">{readyCount}</span>
            <span>ready</span>
          </div>
          {indexingCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-warning-tint)] border border-[rgba(251,191,36,0.3)] text-xs text-[var(--color-warning)]">
              <Clock size={12} className="animate-spin" />
              <span className="font-semibold">{indexingCount}</span>
              <span>indexing</span>
            </div>
          )}
          {failedCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-error-tint)] border border-[var(--color-error-border)] text-xs text-[var(--color-error)]">
              <AlertCircle size={12} />
              <span className="font-semibold">{failedCount}</span>
              <span>failed</span>
            </div>
          )}
        </div>
      )}

      {/* Filter Bar */}
      {!error && (repositories.length > 0 || loading) && (
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-2.5 text-[var(--color-muted)]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter repositories by name, owner, or language..."
            className="pl-8 text-xs h-9 bg-[var(--color-surface)]"
          />
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
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-[var(--color-border)]/50 last:border-0">
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
        <div className="rounded-[var(--radius-panel)] border border-[var(--color-error-border)] bg-[var(--color-error-tint)]/30 p-8 text-center space-y-4 max-w-xl mx-auto mt-8">
          <div className="h-12 w-12 rounded-full bg-[var(--color-error-tint)] border border-[var(--color-error-border)] flex items-center justify-center text-[var(--color-error)] mx-auto">
            <AlertCircle size={24} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text)]">
              Can't reach the server
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1.5">
              We're having trouble connecting to the Codebase Intellisense backend. Check your network or retry.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchRepositories}>
            <RefreshCw size={13} />
            <span>Retry Connection</span>
          </Button>
        </div>
      )}

      {/* Empty State: First Sign-In */}
      {!loading && !error && repositories.length === 0 && (
        <div className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center space-y-5 max-w-lg mx-auto mt-12">
          <div className="h-14 w-14 rounded-2xl bg-[var(--color-raised)] border border-[var(--color-border-strong)] flex items-center justify-center text-[var(--color-accent)] mx-auto">
            <GitBranch size={28} />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-[var(--color-text)]">
              No repositories connected yet
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Connect your first GitHub repository to parse its AST symbols, generate embeddings, and start asking natural-language questions with verified citations.
            </p>
          </div>
          <Button variant="primary" onClick={() => setConnectOpen(true)}>
            <Plus size={15} />
            <span>Connect your first repository</span>
          </Button>
        </div>
      )}

      {/* Populated Table */}
      {!loading && !error && repositories.length > 0 && (
        <div className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-raised)]/50 text-[var(--color-muted)] font-medium">
                  <th className="py-3 px-4">Repository</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Language</th>
                  <th className="py-3 px-4">Volume</th>
                  <th className="py-3 px-4">Last Indexed</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredRepositories.map((repo) => (
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
                            <span>{repo.owner}/{repo.name}</span>
                            {repo.is_private ? (
                              <Lock size={11} className="text-[var(--color-muted)]" />
                            ) : (
                              <Globe size={11} className="text-[var(--color-muted)]" />
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--color-text-secondary)] truncate max-w-xs mt-0.5">
                            {repo.description}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusChip status={repo.latest_job_status} />
                    </td>

                    {/* Language */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-[var(--color-text-secondary)] font-mono text-[11px]">
                      {repo.language}
                    </td>

                    {/* Codebase Volume */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-[var(--color-text-secondary)] font-mono text-[11px]">
                      <div>{formatNumber(repo.lines_of_code)} LOC</div>
                      <div className="text-[10px] text-[var(--color-muted)]">{formatNumber(repo.ast_nodes)} AST nodes</div>
                    </td>

                    {/* Last Indexed */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-[var(--color-muted)] font-mono text-[11px]">
                      {formatRelativeTime(repo.last_indexed_at)}
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
      )}

      {/* Connect Repository Drawer */}
      <ConnectDrawer open={connectOpen} onOpenChange={setConnectOpen} />
    </div>
  );
}
