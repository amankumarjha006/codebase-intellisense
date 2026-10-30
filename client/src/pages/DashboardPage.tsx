import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { ApiError } from '../lib/api';
import { formatRelativeTime, shortSha } from '../lib/utils';
import { StatusChip } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Card, CardHeader, CardDescription, CardContent } from '../components/ui/card';
import { ConnectDrawer } from '../components/repository/ConnectDrawer';
import { useRepositoryPolling } from '../lib/useRepositoryPolling';
import { AnimatedPage } from '../components/ui/AnimatedPage';
import { LiveRegion } from '../components/ui/A11y';
import { useAuth } from '../lib/AuthContext';

export function DashboardPage() {
  const navigate = useNavigate();
  const { markSessionExpired } = useAuth();

  const [connectOpen, setConnectOpen] = React.useState(false);
  const [copiedRequestId, setCopiedRequestId] = React.useState(false);
  const [a11yAnnouncement, setA11yAnnouncement] = React.useState('');

  const {
    repositories,
    total,
    loading,
    isPolling,
    error,
    refetch,
  } = useRepositoryPolling({
    page: 1,
    limit: 100,
    onSessionExpired: markSessionExpired,
  });

  const safeRepos = React.useMemo(() => repositories || [], [repositories]);

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

  // Most recent indexing activity timestamp & repo
  const mostRecentSync = React.useMemo(() => {
    const sorted = [...safeRepos]
      .filter((r) => r.last_indexed_at)
      .sort((a, b) => new Date(b.last_indexed_at!).getTime() - new Date(a.last_indexed_at!).getTime());
    return sorted[0] || null;
  }, [safeRepos]);

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

    safeRepos.forEach((repo) => {
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
  }, [safeRepos]);

  React.useEffect(() => {
    if (loading) {
      setA11yAnnouncement('Loading workspace dashboard...');
    } else if (error) {
      setA11yAnnouncement('Error loading dashboard.');
    } else {
      setA11yAnnouncement(`Loaded workspace dashboard with ${repositories.length} repositories.`);
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
    <AnimatedPage className="relative p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-7">
      <LiveRegion message={a11yAnnouncement} />

      {/* Top Ambient Subtle Gradient */}
      <div
        className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 -z-10 w-full max-w-5xl h-72 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(185,228,208,0.05),transparent_70%)]"
        aria-hidden="true"
      />

      {/* Page Heading & Primary Action */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[var(--color-border)]/50">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-text)]">
            Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] max-w-2xl">
            Overview of your connected repositories, recent updates, and codebase status.
          </p>
        </div>

        {/* Sync & Connect Actions */}
        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={refetch}
            disabled={loading}
            aria-label="Synchronize workspace status"
            title="Synchronize workspace status"
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

      {/* Summary Metrics: Compact Cards */}
      {!loading && !error && repositories.length > 0 && (
        <section aria-label="Workspace metrics overview">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Connected Repositories — Accessible Navigation Link */}
            <Card
              role="link"
              tabIndex={0}
              aria-label="Manage connected repositories in catalog"
              onClick={() => navigate('/repositories')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate('/repositories');
                }
              }}
              className="card-top-accent bg-[var(--color-surface)]/90 border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-all shadow-sm cursor-pointer group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-mint-accent,#B9E4D0)]"
            >
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider group-hover:text-[var(--color-text)] transition-colors">
                  Connected Repositories
                </CardDescription>
                <div className="h-8 w-8 rounded-lg bg-[var(--color-raised)] flex items-center justify-center text-[var(--color-mint-accent,#B9E4D0)]">
                  <MaterialIcon name="folder" size={18} fill={1} color="var(--color-mint-accent, #B9E4D0)" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-1">
                <div className="text-2xl font-bold font-mono text-[var(--color-text)] flex items-center justify-between">
                  <span>{total}</span>
                  <MaterialIcon name="arrow_forward" size={16} className="text-[var(--color-muted)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition" />
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  Total repositories in workspace
                </p>
              </CardContent>
            </Card>

            {/* 2. Ready & Searchable */}
            <Card className="card-top-accent bg-[var(--color-surface)]/90 border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-all shadow-sm">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                  Ready to Search
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
                  Fully indexed and ready for queries
                </p>
              </CardContent>
            </Card>

            {/* 3. Active Pipelines */}
            <Card className="card-top-accent bg-[var(--color-surface)]/90 border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-all shadow-sm">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                  Indexing
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
                  {activeCount > 0 ? 'Analyzing repository code' : 'All repositories are up to date'}
                </p>
              </CardContent>
            </Card>

            {/* 4. Recent Synchronization Activity */}
            <Card className="card-top-accent bg-[var(--color-surface)]/90 border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-all shadow-sm">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                  Last Updated
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
          aria-label="Loading workspace dashboard"
          className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm p-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-[var(--radius-panel)]" />
            ))}
          </div>
          <div className="space-y-3 pt-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
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
                Unable to connect to server
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Could not load workspace records. Please check your network connection and try again.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <Button variant="primary" size="sm" onClick={refetch}>
                <MaterialIcon name="sync" size={18} aria-hidden="true" />
                <span>Retry</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State: 0 Repositories Connected */}
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
              Welcome to Codebase Intellisense
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Connect your first repository to search code, explore architecture, and ask questions with verified citations.
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
                <span>Code Intelligence</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-normal">
                Understands functions, classes, and relationships across your codebase.
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
                <MaterialIcon name="layers" size={16} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                <span>Fast & Secure</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-normal">
                Instant search and codebase exploration with enterprise-grade security.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Active Codebases: Quick Access Cards */}
      {!loading && !error && safeRepos.length > 0 && (
        <section aria-labelledby="active-codebases-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="active-codebases-heading" className="text-sm font-semibold tracking-tight text-[var(--color-text)]">
                Active Codebases
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Quick access to intelligence tools for your indexed repositories
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/repositories')}
              className="text-xs gap-1.5 h-8 font-medium cursor-pointer"
            >
              <span>View all in table ({total})</span>
              <MaterialIcon name="arrow_forward" size={14} aria-hidden="true" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {safeRepos.map((repo) => {
              const activeSha = repo.active_version_short_sha || '';
              const isReady = repo.latest_job_status === 'READY' || (activeSha && !repo.latest_job_status);
              const isIndexing = ['QUEUED', 'FETCHING', 'INDEXING', 'ANALYZING'].includes(repo.latest_job_status || '');
              const isFailed = repo.latest_job_status === 'FAILED';

              return (
                <div
                  key={repo.id}
                  className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex flex-col justify-between gap-4 hover:border-[var(--color-border-strong)] transition-all group"
                >
                  <div className="space-y-3">
                    {/* Header: Title + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="h-8 w-8 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-mint-accent,#B9E4D0)] shrink-0 group-hover:scale-105 transition-transform"
                          aria-hidden="true"
                        >
                          <MaterialIcon name="folder" size={20} fill={1} color="var(--color-mint-accent, #B9E4D0)" />
                        </div>
                        <div className="min-w-0">
                          <button
                            onClick={() => navigate(`/repositories/${repo.id}`)}
                            className="font-semibold text-xs text-[var(--color-text)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition-colors truncate block text-left cursor-pointer"
                            title={`${repo.owner}/${repo.name}`}
                          >
                            <span className="text-[var(--color-muted)] font-normal">{repo.owner}/</span>
                            <span>{repo.name}</span>
                          </button>
                          <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-muted)] font-mono">
                            {repo.is_private ? (
                              <span className="inline-flex items-center gap-0.5">
                                <MaterialIcon name="lock" size={11} aria-label="Private repository" />
                                <span>Private</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5">
                                <MaterialIcon name="public" size={11} aria-label="Public repository" />
                                <span>Public</span>
                              </span>
                            )}
                            {activeSha && (
                              <>
                                <span>·</span>
                                <span className="inline-flex items-center gap-0.5">
                                  <MaterialIcon name="commit" size={11} aria-hidden="true" />
                                  <span>{shortSha(activeSha)}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Chip */}
                      <div className="shrink-0">
                        {isReady && <StatusChip status="READY" />}
                        {isIndexing && <StatusChip status="INDEXING" />}
                        {isFailed && <StatusChip status="FAILED" />}
                        {!isReady && !isIndexing && !isFailed && <StatusChip status="NOT_INDEXED" />}
                      </div>
                    </div>

                    {/* Metadata strip */}
                    <div className="flex items-center justify-between text-[11px] text-[var(--color-muted)] pt-1 border-t border-[var(--color-border)]/40">
                      <span className="inline-flex items-center gap-1 font-mono">
                        <MaterialIcon name="call_split" size={13} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                        <span>main</span>
                      </span>
                      <span>
                        {isIndexing ? (
                          <span className="text-[var(--color-warning)] inline-flex items-center gap-1">
                            <MaterialIcon name="sync" size={12} spin aria-hidden="true" />
                            <span>Indexing...</span>
                          </span>
                        ) : repo.last_indexed_at ? (
                          <span>Indexed {formatRelativeTime(repo.last_indexed_at)}</span>
                        ) : (
                          <span>Not indexed yet</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Quick-Launch Capability Buttons — Contextually Gated when Ready */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!isReady}
                        onClick={() => navigate(`/repositories/${repo.id}/chat`)}
                        className="h-7 px-1.5 text-[11px] gap-1 font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-mint-accent,#B9E4D0)] justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                        title={isReady ? 'Open AI Chat for this repo' : 'Requires completed indexing before querying'}
                      >
                        <MaterialIcon name="chat" size={13} aria-hidden="true" />
                        <span>Chat</span>
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!isReady}
                        onClick={() => navigate(`/repositories/${repo.id}/architecture`)}
                        className="h-7 px-1.5 text-[11px] gap-1 font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-mint-accent,#B9E4D0)] justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                        title={isReady ? 'Open Architecture Graph' : 'Requires completed indexing to visualize syntax graph'}
                      >
                        <MaterialIcon name="account_tree" size={13} aria-hidden="true" />
                        <span>Arch</span>
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!isReady}
                        onClick={() => navigate(`/repositories/${repo.id}/search`)}
                        className="h-7 px-1.5 text-[11px] gap-1 font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-mint-accent,#B9E4D0)] justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                        title={isReady ? 'Semantic & Symbol Search' : 'Requires completed indexing for vector search'}
                      >
                        <MaterialIcon name="search" size={13} aria-hidden="true" />
                        <span>Search</span>
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!isReady}
                        onClick={() => navigate(`/repositories/${repo.id}/files`)}
                        className="h-7 px-1.5 text-[11px] gap-1 font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-mint-accent,#B9E4D0)] justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                        title={isReady ? 'Explore Repository Files' : 'Requires completed repository clone'}
                      >
                        <MaterialIcon name="folder_open" size={13} aria-hidden="true" />
                        <span>Files</span>
                      </Button>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/repositories/${repo.id}`)}
                      className="w-full h-7 text-xs font-medium gap-1 text-[var(--color-mint-accent,#B9E4D0)] hover:text-[var(--color-mint-hover,#D0F1E0)] hover:bg-[var(--color-raised)]/60 justify-center cursor-pointer"
                    >
                      <span>Open Overview</span>
                      <MaterialIcon name="arrow_forward" size={13} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent Activity Section */}
      {!loading && !error && recentActivities.length > 0 && (
        <section aria-labelledby="recent-activity-heading" className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 id="recent-activity-heading" className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Recent Activity
            </h2>
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
                      {act.type === 'INDEXED' && 'Repository indexed'}
                      {act.type === 'INDEXING' && 'Indexing in progress'}
                      {act.type === 'FAILED' && `Indexing failed${act.failureCode ? `: ${act.failureCode}` : ''}`}
                      {act.type === 'CONNECTED' && 'Repository connected'}
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
                    className="h-6 px-2 text-[11px] text-[var(--color-mint-accent,#B9E4D0)] hover:text-[var(--color-mint-hover,#D0F1E0)] cursor-pointer"
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
    </AnimatedPage>
  );
}
