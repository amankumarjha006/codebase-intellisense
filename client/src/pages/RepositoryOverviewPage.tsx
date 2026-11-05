import * as React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { StatusDot } from '../components/ui/StatusDot';
import { Button } from '../components/ui/button';
import { RepositoryHeader } from '../components/repository/RepositoryHeader';
import { realApi, type RepositoryDetailOut, type FileOut } from '../lib/api';
import { formatNumber, formatRelativeTime, shortSha } from '../lib/utils';
import { classifyPath } from '../lib/classifyPath';
import { getRepositoryStatusCategory } from '../lib/repositoryTableUtils';
import { setLastOpenedRepoId } from '../lib/repositoryTableUtils';
import { useAuth } from '../lib/AuthContext';

export function RepositoryOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [repo, setRepo] = React.useState<RepositoryDetailOut | null>(null);
  const [files, setFiles] = React.useState<FileOut[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = React.useState(false);

  // Store last-opened repo in localStorage keyed by user id
  React.useEffect(() => {
    if (id) {
      setLastOpenedRepoId(user?.id, id);
    }
  }, [id, user?.id]);

  const loadRepositoryData = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const detail = await realApi.getRepositoryDetail(id);
      setRepo(detail);

      // Fetch files list for entry points and metrics
      try {
        const filesRes = await realApi.getRepositoryFiles(id, 1, 500);
        setFiles(filesRes.files || []);
      } catch {
        setFiles([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Repository not found');
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    loadRepositoryData();
  }, [loadRepositoryData]);

  const handleReindex = async () => {
    if (!id) return;
    await realApi.analyzeRepository(id);
    loadRepositoryData();
  };

  // Identify entry points from files (main.py, app.py, index.ts, App.tsx, etc.)
  const entryPoints = React.useMemo(() => {
    if (!files || files.length === 0) return [];
    const candidates = [
      'main.py',
      'app.py',
      'server.py',
      'index.ts',
      'index.tsx',
      'index.js',
      'app.tsx',
      'main.go',
      'main.rs',
      'lib.rs',
    ];

    return files
      .filter((file) => {
        const fileName = file.path.split('/').pop()?.toLowerCase() || '';
        return candidates.includes(fileName) && classifyPath(file.path) === 'source';
      })
      .slice(0, 5);
  }, [files]);

  // Compute sampled hotspots from files (sorted by size as proxy for complexity)
  const hotspots = React.useMemo(() => {
    if (!files || files.length === 0) return [];
    return files
      .filter((file) => classifyPath(file.path) === 'source')
      .sort((a, b) => (b.size || 0) - (a.size || 0))
      .slice(0, 6);
  }, [files]);

  if (loading) {
    return (
      <div className="p-8 max-w-[1200px] mx-auto text-xs text-text-tertiary">
        Loading repository overview...
      </div>
    );
  }

  if (error || !repo) {
    return (
      <div className="p-12 max-w-md mx-auto text-center space-y-4">
        <MaterialIcon name="error" size={32} className="text-status-red mx-auto" />
        <h2 className="text-base font-semibold text-text-primary">Repository not found</h2>
        <p className="text-xs text-text-secondary">{error}</p>
        <Button variant="ghost" onClick={() => navigate('/repositories')} className="text-xs">
          Back to Repositories
        </Button>
      </div>
    );
  }

  const activeVersion = repo.active_version;
  const statusCategory = getRepositoryStatusCategory({
    id: repo.id,
    owner: repo.owner,
    name: repo.name,
    is_private: repo.is_private,
    created_at: '',
    latest_job_status: activeVersion?.status || null,
    latest_job_failure_code: null,
    active_version_short_sha: activeVersion?.commit_sha || null,
    last_indexed_at: activeVersion?.indexed_at || null,
  });

  return (
    <div className="space-y-6">
      {/* Sticky 5-tab Header */}
      <RepositoryHeader repository={repo} onReindex={handleReindex} />

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-10 pb-16 space-y-8">
        {/* 1. Compact Stat Strip (4 items) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-lg border border-white/10 bg-surface-raised space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
              Primary Language
            </span>
            <div className="text-sm font-semibold text-text-primary">
              {repo.primary_language || 'Python'}
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-white/10 bg-surface-raised space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
              Indexed Files
            </span>
            <div className="text-sm font-semibold text-text-primary font-mono tabular-nums">
              {files.length > 0 ? formatNumber(files.length) : '—'}
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-white/10 bg-surface-raised space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
              Lines of Code
            </span>
            <div className="text-sm font-semibold text-text-primary font-mono tabular-nums">
              {repo.lines_of_code ? formatNumber(repo.lines_of_code) : '—'}
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-white/10 bg-surface-raised space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
              Last Indexed
            </span>
            <div className="text-sm font-semibold text-text-primary tabular-nums">
              {activeVersion?.indexed_at
                ? formatRelativeTime(activeVersion.indexed_at)
                : 'Never'}
            </div>
          </div>
        </div>

        {/* 2. Start Here & Index Health 2-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Start Here Card */}
          <div className="p-4 rounded-lg border border-white/10 bg-surface-raised space-y-3">
            <div className="flex items-center gap-2">
              <MaterialIcon name="near_me" size={16} className="text-accent" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Start Here
              </h2>
            </div>
            <p className="text-xs text-text-secondary">
              Key entry points and primary modules identified in this repository:
            </p>

            <div className="divide-y divide-white/5 border border-white/5 rounded-md overflow-hidden bg-surface-base/50">
              {entryPoints.length > 0 ? (
                entryPoints.map((ep) => (
                  <Link
                    key={ep.path}
                    to={`/repositories/${repo.id}/files?path=${encodeURIComponent(ep.path)}`}
                    className="p-2.5 flex items-center justify-between text-xs hover:bg-surface-overlay/60 transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MaterialIcon
                        name="description"
                        size={14}
                        className="text-text-tertiary group-hover:text-accent"
                      />
                      <span className="font-mono text-text-primary group-hover:text-accent truncate">
                        {ep.path}
                      </span>
                    </div>
                    <MaterialIcon name="chevron_right" size={14} className="text-text-tertiary" />
                  </Link>
                ))
              ) : (
                <div className="p-3 text-xs text-text-tertiary text-center">
                  No explicit entry point files detected.
                </div>
              )}
            </div>
          </div>

          {/* Index Health Card */}
          <div className="p-4 rounded-lg border border-white/10 bg-surface-raised space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MaterialIcon name="health_and_safety" size={16} className="text-accent" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  Index Health
                </h2>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                <StatusDot
                  status={
                    statusCategory === 'INDEXING'
                      ? 'indexing'
                      : statusCategory === 'FAILED'
                      ? 'failed'
                      : 'ready'
                  }
                />
                <span className="capitalize">{statusCategory.toLowerCase()}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-text-secondary">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-text-tertiary">Active Branch</span>
                <span className="font-mono text-text-primary">{activeVersion?.branch || 'main'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-text-tertiary">Commit SHA</span>
                <span className="font-mono text-text-primary">
                  {activeVersion?.commit_sha ? shortSha(activeVersion.commit_sha) : '—'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-tertiary">AST Nodes Analyzed</span>
                <span className="font-mono text-text-primary tabular-nums">
                  {repo.ast_nodes ? formatNumber(repo.ast_nodes) : '—'}
                </span>
              </div>
            </div>

            {statusCategory === 'FAILED' && (
              <div className="pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReindex}
                  className="w-full text-xs text-status-red border border-status-red/20 hover:bg-status-red/10"
                >
                  Retry indexing
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 3. Hotspots Table with "Approximate (based on sampled edge evidence)" Label */}
        <div className="p-4 rounded-lg border border-white/10 bg-surface-raised space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <MaterialIcon name="local_fire_department" size={16} className="text-accent" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Top Code Hotspots
              </h2>
            </div>
            <span className="text-[11px] text-text-tertiary italic">
              Approximate (based on sampled edge evidence)
            </span>
          </div>

          <div className="divide-y divide-white/5 border border-white/5 rounded-md overflow-hidden bg-surface-base/50">
            {hotspots.length > 0 ? (
              hotspots.map((hs, index) => (
                <Link
                  key={hs.path}
                  to={`/repositories/${repo.id}/files?path=${encodeURIComponent(hs.path)}`}
                  className="p-2.5 flex items-center justify-between text-xs hover:bg-surface-overlay/60 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-text-tertiary font-mono text-[11px] w-4">
                      {index + 1}
                    </span>
                    <span className="font-mono text-text-primary group-hover:text-accent truncate">
                      {hs.path}
                    </span>
                  </div>
                  <span className="text-[11px] text-text-tertiary font-mono tabular-nums shrink-0">
                    {hs.size ? `${Math.round(hs.size / 1024)} KB` : 'source'}
                  </span>
                </Link>
              ))
            ) : (
              <div className="p-4 text-xs text-text-tertiary text-center">
                No hotspots calculated yet.
              </div>
            )}
          </div>
        </div>

        {/* 4. Conditional Index History (collapsible, only if history available) */}
        {activeVersion && (
          <div className="rounded-lg border border-white/10 bg-surface-raised overflow-hidden">
            <button
              type="button"
              onClick={() => setHistoryOpen(!historyOpen)}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-surface-overlay/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              aria-expanded={historyOpen}
            >
              <div className="flex items-center gap-2">
                <MaterialIcon
                  name={historyOpen ? 'expand_more' : 'chevron_right'}
                  size={18}
                  className="text-text-tertiary"
                />
                <span className="text-xs font-semibold text-text-primary">
                  Indexing history
                </span>
              </div>
              <span className="text-[11px] text-text-tertiary">
                {historyOpen ? 'Collapse' : 'Expand'}
              </span>
            </button>

            {historyOpen && (
              <div className="p-4 border-t border-white/5 text-xs text-text-secondary space-y-2 bg-surface-base/30">
                <div className="flex items-center justify-between py-1">
                  <span className="font-mono">{shortSha(activeVersion.commit_sha)}</span>
                  <span className="text-text-tertiary">
                    {activeVersion.indexed_at
                      ? formatRelativeTime(activeVersion.indexed_at)
                      : 'Initial commit'}
                  </span>
                  <span className="capitalize text-status-green">Completed</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
export default RepositoryOverviewPage;
