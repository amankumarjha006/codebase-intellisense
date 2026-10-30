import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { ApiError } from '../lib/api';
import { formatRelativeTime, shortSha } from '../lib/utils';
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

  const failedCount = React.useMemo(() => {
    return safeRepos.filter((r) => r.latest_job_status === 'FAILED').length;
  }, [safeRepos]);

  const publicCount = React.useMemo(() => {
    return safeRepos.filter((r) => !r.is_private).length;
  }, [safeRepos]);

  const privateCount = React.useMemo(() => {
    return safeRepos.filter((r) => r.is_private).length;
  }, [safeRepos]);

  const readinessPercentage = React.useMemo(() => {
    if (total === 0) return 0;
    return Math.round((readyCount / total) * 100);
  }, [readyCount, total]);

  // Primary ready repository for instant jump in Launchpad
  const primaryReadyRepo = React.useMemo(() => {
    return (
      safeRepos.find(
        (r) => r.latest_job_status === 'READY' || (r.active_version_short_sha && !r.latest_job_status)
      ) || safeRepos[0] || null
    );
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
      .slice(0, 6);
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
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-text)]">
              Workspace Overview
            </h1>
            {!loading && !error && repositories.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-[var(--color-mint-selected-bg,#1B332A)] text-[var(--color-mint-accent,#B9E4D0)] border border-[rgba(185,228,208,0.25)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-mint-accent,#B9E4D0)] animate-pulse" aria-hidden="true" />
                <span>Operational</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] max-w-2xl">
            Real-time codebase telemetry, indexing status, and intelligence capabilities.
          </p>
        </div>

        {/* Sync & Repositories Navigation Actions */}
        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={refetch}
            disabled={loading}
            aria-label="Synchronize workspace status"
            title="Synchronize workspace status"
            className="h-9 px-3 gap-1.5 cursor-pointer"
          >
            <MaterialIcon name="sync" size={17} spin={loading || isPolling} aria-hidden="true" />
            <span className="hidden sm:inline font-medium text-xs">Sync</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/repositories')}
            aria-label="Go to Repositories Catalog"
            className="h-9 px-3.5 text-xs font-medium gap-1.5 cursor-pointer border-[var(--color-border)] hover:border-[var(--color-mint-accent,#B9E4D0)]/40 transition"
          >
            <MaterialIcon name="list" size={17} aria-hidden="true" />
            <span>Repositories Catalog ({total})</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setConnectOpen(true)}
            aria-label="Connect new repository"
            className="h-9 px-3.5 font-medium text-xs gap-1.5 shadow-sm hover:shadow transition cursor-pointer"
          >
            <MaterialIcon name="add" size={18} aria-hidden="true" />
            <span>Connect Repo</span>
          </Button>
        </div>
      </header>

      {/* Summary Metrics: Elevated Telemetry Cards */}
      {!loading && !error && repositories.length > 0 && (
        <section aria-label="Workspace metrics overview">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Connected Repositories Card */}
            <Card
              role="link"
              tabIndex={0}
              aria-label="View connected repositories in catalog"
              onClick={() => navigate('/repositories')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate('/repositories');
                }
              }}
              className="card-top-accent bg-[var(--color-surface)]/90 border-[var(--color-border)] hover:border-[var(--color-mint-accent,#B9E4D0)]/40 transition-all shadow-sm cursor-pointer group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-mint-accent,#B9E4D0)]"
            >
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider group-hover:text-[var(--color-text)] transition-colors">
                  Connected Codebases
                </CardDescription>
                <div className="h-8 w-8 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-mint-accent,#B9E4D0)] shadow-xs">
                  <MaterialIcon name="folder" size={18} fill={1} color="var(--color-mint-accent, #B9E4D0)" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-[var(--color-text)]">{total}</span>
                  <span className="text-xs font-mono text-[var(--color-muted)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition-colors inline-flex items-center gap-1">
                    <span>Manage</span>
                    <MaterialIcon name="arrow_forward" size={13} aria-hidden="true" />
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)] font-mono">
                  <span>{publicCount} public</span>
                  <span className="text-[var(--color-muted)]">·</span>
                  <span>{privateCount} private</span>
                </div>
              </CardContent>
            </Card>

            {/* 2. Codebase Readiness with Visual Progress Bar */}
            <Card className="card-top-accent bg-[var(--color-surface)]/90 border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-all shadow-sm">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                  Search Readiness
                </CardDescription>
                <div className="h-8 w-8 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-mint-accent,#B9E4D0)] shadow-xs">
                  <MaterialIcon name="check_circle" size={18} fill={1} color="var(--color-mint-accent, #B9E4D0)" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2">
                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-bold font-mono text-[var(--color-mint-accent,#B9E4D0)] flex items-center gap-2">
                    <span>{readinessPercentage}%</span>
                    {readinessPercentage === 100 && (
                      <span className="h-2 w-2 rounded-full bg-[var(--color-mint-accent,#B9E4D0)] animate-pulse" aria-hidden="true" />
                    )}
                  </div>
                  <span className="text-xs font-mono text-[var(--color-muted)]">
                    {readyCount} of {total} ready
                  </span>
                </div>
                {/* Visual Progress Bar */}
                <div className="h-1.5 w-full bg-[var(--color-raised)] rounded-full overflow-hidden border border-[var(--color-border)]/50">
                  <div
                    className="h-full bg-[var(--color-mint-accent,#B9E4D0)] rounded-full transition-all duration-500"
                    style={{ width: `${readinessPercentage}%` }}
                  />
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  {readinessPercentage === 100
                    ? 'All codebases query-ready'
                    : `${total - readyCount} codebases indexing`}
                </p>
              </CardContent>
            </Card>

            {/* 3. Pipeline & Sync Telemetry */}
            <Card className="card-top-accent bg-[var(--color-surface)]/90 border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-all shadow-sm">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                  Active Pipelines
                </CardDescription>
                <div className="h-8 w-8 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center shadow-xs">
                  <MaterialIcon
                    name="sync"
                    size={18}
                    spin={activeCount > 0}
                    color={activeCount > 0 ? 'var(--color-warning)' : 'var(--color-mint-accent, #B9E4D0)'}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-[var(--color-text)]">
                    {activeCount > 0 ? `${activeCount} Jobs` : 'Idle'}
                  </span>
                  <span className="text-xs font-mono text-[var(--color-muted)]">
                    {failedCount > 0 ? `${failedCount} failed` : '0 errors'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      activeCount > 0 ? 'bg-[var(--color-warning)] animate-ping' : 'bg-[var(--color-mint-accent,#B9E4D0)]'
                    }`}
                  />
                  <span>{activeCount > 0 ? 'Indexing code structure' : 'All systems nominal'}</span>
                </div>
              </CardContent>
            </Card>

            {/* 4. Recent Synchronization Activity */}
            <Card
              role={mostRecentSync ? 'link' : undefined}
              tabIndex={mostRecentSync ? 0 : undefined}
              onClick={() => mostRecentSync && navigate(`/repositories/${mostRecentSync.id}`)}
              onKeyDown={(e) => {
                if (mostRecentSync && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  navigate(`/repositories/${mostRecentSync.id}`);
                }
              }}
              className={`card-top-accent bg-[var(--color-surface)]/90 border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-all shadow-sm ${
                mostRecentSync ? 'cursor-pointer group' : ''
              }`}
            >
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider group-hover:text-[var(--color-text)] transition-colors">
                  Last Updated
                </CardDescription>
                <div className="h-8 w-8 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-mint-accent,#B9E4D0)] shadow-xs">
                  <MaterialIcon
                    name="schedule"
                    size={18}
                    fill={1}
                    color="var(--color-mint-accent, #B9E4D0)"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2">
                <div className="text-2xl font-bold font-mono text-[var(--color-text)] truncate">
                  {mostRecentSync?.last_indexed_at
                    ? formatRelativeTime(mostRecentSync.last_indexed_at)
                    : 'Up to date'}
                </div>
                <div className="text-[11px] text-[var(--color-text-secondary)] truncate flex items-center gap-1.5">
                  {mostRecentSync ? (
                    <>
                      <span className="truncate font-medium group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition-colors">
                        {mostRecentSync.owner}/{mostRecentSync.name}
                      </span>
                      {mostRecentSync.active_version_short_sha && (
                        <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-[var(--color-raised)] border border-[var(--color-border)] text-[var(--color-muted)] shrink-0">
                          {shortSha(mostRecentSync.active_version_short_sha)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span>All repositories synchronized</span>
                  )}
                </div>
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
            <Skeleton className="h-64 lg:col-span-2 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
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

      {/* Main Grid: Intelligence Launchpad & Workspace Distribution */}
      {!loading && !error && safeRepos.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (8-col): Intelligence Launchpad & Activity Timeline */}
          <div className="lg:col-span-8 space-y-6">
            {/* Intelligence Launchpad */}
            <section aria-labelledby="launchpad-heading" className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 id="launchpad-heading" className="text-sm font-semibold tracking-tight text-[var(--color-text)]">
                    Intelligence Launchpad
                  </h2>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Fast access to repository tools and codebase query capabilities
                  </p>
                </div>
                {primaryReadyRepo && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-[var(--color-muted)]">
                    <span>Active:</span>
                    <span className="text-[var(--color-mint-accent,#B9E4D0)] font-semibold">
                      {primaryReadyRepo.owner}/{primaryReadyRepo.name}
                    </span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Global Code Search */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(primaryReadyRepo ? `/repositories/${primaryReadyRepo.id}/search` : '/repositories')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(primaryReadyRepo ? `/repositories/${primaryReadyRepo.id}/search` : '/repositories');
                    }
                  }}
                  className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex flex-col justify-between gap-3 hover:border-[var(--color-mint-accent,#B9E4D0)]/40 hover:bg-[var(--color-raised)]/30 transition-all cursor-pointer group shadow-sm text-left"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="h-9 w-9 rounded-xl bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-mint-accent,#B9E4D0)] group-hover:scale-105 transition-transform">
                        <MaterialIcon name="search" size={20} color="var(--color-mint-accent, #B9E4D0)" />
                      </div>
                      <kbd className="hidden sm:inline-flex items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-raised)] h-5 px-1.5 text-[10px] font-mono text-[var(--color-muted)]">
                        /
                      </kbd>
                    </div>
                    <div>
                      <h3 className="font-semibold text-xs text-[var(--color-text)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition-colors">
                        Code Search
                      </h3>
                      <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed mt-0.5">
                        Query functions, symbols, and files across your indexed code.
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[var(--color-border)]/40 flex items-center justify-between text-[11px] font-medium text-[var(--color-mint-accent,#B9E4D0)]">
                    <span>Search codebase</span>
                    <MaterialIcon name="arrow_forward" size={13} aria-hidden="true" />
                  </div>
                </div>

                {/* 2. AI Codebase Assistant */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(primaryReadyRepo ? `/repositories/${primaryReadyRepo.id}/chat` : '/repositories')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(primaryReadyRepo ? `/repositories/${primaryReadyRepo.id}/chat` : '/repositories');
                    }
                  }}
                  className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex flex-col justify-between gap-3 hover:border-[var(--color-mint-accent,#B9E4D0)]/40 hover:bg-[var(--color-raised)]/30 transition-all cursor-pointer group shadow-sm text-left"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="h-9 w-9 rounded-xl bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-mint-accent,#B9E4D0)] group-hover:scale-105 transition-transform">
                        <MaterialIcon name="chat" size={20} color="var(--color-mint-accent, #B9E4D0)" />
                      </div>
                      <span className="h-2 w-2 rounded-full bg-[var(--color-mint-accent,#B9E4D0)]" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-xs text-[var(--color-text)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition-colors">
                        AI Codebase Chat
                      </h3>
                      <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed mt-0.5">
                        Ask questions in natural language with verified citations.
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[var(--color-border)]/40 flex items-center justify-between text-[11px] font-medium text-[var(--color-mint-accent,#B9E4D0)]">
                    <span>Ask questions</span>
                    <MaterialIcon name="arrow_forward" size={13} aria-hidden="true" />
                  </div>
                </div>

                {/* 3. Architecture Visualizer */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(primaryReadyRepo ? `/repositories/${primaryReadyRepo.id}/architecture` : '/repositories')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(primaryReadyRepo ? `/repositories/${primaryReadyRepo.id}/architecture` : '/repositories');
                    }
                  }}
                  className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex flex-col justify-between gap-3 hover:border-[var(--color-mint-accent,#B9E4D0)]/40 hover:bg-[var(--color-raised)]/30 transition-all cursor-pointer group shadow-sm text-left"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="h-9 w-9 rounded-xl bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-mint-accent,#B9E4D0)] group-hover:scale-105 transition-transform">
                        <MaterialIcon name="account_tree" size={20} color="var(--color-mint-accent, #B9E4D0)" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-xs text-[var(--color-text)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition-colors">
                        Architecture Map
                      </h3>
                      <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed mt-0.5">
                        Explore module dependency graphs and symbol hierarchy.
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[var(--color-border)]/40 flex items-center justify-between text-[11px] font-medium text-[var(--color-mint-accent,#B9E4D0)]">
                    <span>Explore graph</span>
                    <MaterialIcon name="arrow_forward" size={13} aria-hidden="true" />
                  </div>
                </div>
              </div>
            </section>

            {/* Recent Activity Timeline */}
            {recentActivities.length > 0 && (
              <section aria-labelledby="activity-feed-heading" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 id="activity-feed-heading" className="text-sm font-semibold tracking-tight text-[var(--color-text)]">
                    Recent Activity
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/repositories')}
                    className="text-xs text-[var(--color-mint-accent,#B9E4D0)] hover:text-[var(--color-mint-hover,#D0F1E0)] gap-1 cursor-pointer h-7 px-2"
                  >
                    <span>View all in Repositories</span>
                    <MaterialIcon name="arrow_forward" size={13} aria-hidden="true" />
                  </Button>
                </div>

                <div className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 divide-y divide-[var(--color-border)]/60 shadow-sm">
                  {recentActivities.map((act) => (
                    <div
                      key={act.id}
                      className="py-2.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-[var(--color-raised)]/40 rounded transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="shrink-0">
                          {act.type === 'INDEXED' && (
                            <MaterialIcon name="check_circle" size={17} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-label="Completed" />
                          )}
                          {act.type === 'INDEXING' && (
                            <MaterialIcon name="sync" size={17} spin color="var(--color-warning)" aria-label="Indexing" />
                          )}
                          {act.type === 'FAILED' && (
                            <MaterialIcon name="error" size={17} fill={1} color="var(--color-error)" aria-label="Failed" />
                          )}
                          {act.type === 'CONNECTED' && (
                            <MaterialIcon name="add_circle" size={17} color="var(--color-mint-accent, #B9E4D0)" aria-label="Connected" />
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
          </div>

          {/* Right Column (4-col): Workspace Distribution & Connect */}
          <div className="lg:col-span-4 space-y-6">
            {/* Workspace Distribution Card */}
            <Card className="bg-[var(--color-surface)]/90 border-[var(--color-border)] shadow-sm">
              <CardHeader className="p-4 pb-3 border-b border-[var(--color-border)]/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Codebase Distribution
                  </h3>
                  <span className="text-xs font-mono font-medium text-[var(--color-text)]">
                    {total} total
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Status Bar Breakdown */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-[var(--color-text)]">
                        <span className="h-2 w-2 rounded-full bg-[var(--color-mint-accent,#B9E4D0)]" />
                        <span>Ready & Searchable</span>
                      </span>
                      <span className="font-mono font-semibold text-[var(--color-mint-accent,#B9E4D0)]">{readyCount}</span>
                    </div>
                    <div className="h-1.5 w-full bg-[var(--color-raised)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--color-mint-accent,#B9E4D0)] rounded-full"
                        style={{ width: `${total > 0 ? (readyCount / total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-[var(--color-text)]">
                        <span className="h-2 w-2 rounded-full bg-[var(--color-warning)]" />
                        <span>Indexing</span>
                      </span>
                      <span className="font-mono font-semibold text-[var(--color-warning)]">{activeCount}</span>
                    </div>
                    <div className="h-1.5 w-full bg-[var(--color-raised)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--color-warning)] rounded-full"
                        style={{ width: `${total > 0 ? (activeCount / total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {failedCount > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-[var(--color-text)]">
                          <span className="h-2 w-2 rounded-full bg-[var(--color-error)]" />
                          <span>Failed</span>
                        </span>
                        <span className="font-mono font-semibold text-[var(--color-error)]">{failedCount}</span>
                      </div>
                      <div className="h-1.5 w-full bg-[var(--color-raised)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-error)] rounded-full"
                          style={{ width: `${total > 0 ? (failedCount / total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Visibility pills */}
                <div className="pt-2 border-t border-[var(--color-border)]/40 flex items-center justify-between text-xs">
                  <span className="text-[var(--color-muted)] text-[11px]">Visibility</span>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--color-raised)] border border-[var(--color-border)] text-[var(--color-text-secondary)]">
                      <MaterialIcon name="public" size={11} aria-hidden="true" />
                      <span>{publicCount} Public</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--color-raised)] border border-[var(--color-border)] text-[var(--color-text-secondary)]">
                      <MaterialIcon name="lock" size={11} aria-hidden="true" />
                      <span>{privateCount} Private</span>
                    </span>
                  </div>
                </div>

                {/* Primary Button to Catalog */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/repositories')}
                  className="w-full h-8 text-xs font-semibold text-[var(--color-mint-accent,#B9E4D0)] hover:text-[var(--color-mint-hover,#D0F1E0)] hover:border-[var(--color-mint-accent,#B9E4D0)]/40 justify-center gap-1.5 cursor-pointer mt-1"
                >
                  <span>Open Full Repositories Table</span>
                  <MaterialIcon name="arrow_forward" size={13} aria-hidden="true" />
                </Button>
              </CardContent>
            </Card>

            {/* Quick Connect Repository Card */}
            <div className="rounded-[var(--radius-panel)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)]/60 p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-mint-accent,#B9E4D0)] shrink-0">
                  <MaterialIcon name="add" size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[var(--color-text)]">Connect Repository</h4>
                  <p className="text-[11px] text-[var(--color-muted)]">Read-only GitHub sync</p>
                </div>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                Connect any GitHub repository to index symbols, explore dependencies, and enable AI search.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setConnectOpen(true)}
                className="w-full h-8 text-xs font-semibold justify-center gap-1.5 cursor-pointer"
              >
                <MaterialIcon name="add" size={16} aria-hidden="true" />
                <span>Connect new repository</span>
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
    </AnimatedPage>
  );
}
