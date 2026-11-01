import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { api, getCachedRepository } from '../lib/api';
import { Repository, IndexJob } from '../lib/types';
import { IN_PROGRESS_STATUSES } from '../lib/status';
import { formatNumber, formatRelativeTime, shortSha } from '../lib/utils';
import { RepositoryHeader } from '../components/repository/RepositoryHeader';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '../components/ui/table';
import { Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip';
import { AnimatedPage } from '../components/ui/AnimatedPage';
import { toast } from '../components/ui/sonner';
import { RepositoryAnalyticsCharts } from '../components/repository/RepositoryAnalyticsCharts';

export function RepositoryOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [repository, setRepository] = React.useState<Repository | null>(() => (id ? getCachedRepository(id) : null));
  const [indexJob, setIndexJob] = React.useState<IndexJob | null>(null);
  const [filesCount, setFilesCount] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [copiedSha, setCopiedSha] = React.useState<string | null>(null);

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    toast.success(`Copied commit SHA: ${shortSha(sha)}`);
    setTimeout(() => {
      setCopiedSha((cur) => (cur === sha ? null : cur));
    }, 2000);
  };

  const loadData = React.useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const repo = await api.getRepository(id);
      setRepository(repo);

      // Fetch files count safely from active files list
      try {
        const filesRes = await api.getRepositoryFiles(id, 1, 0);
        setFilesCount(filesRes.total ?? (filesRes.files ? filesRes.files.length : null));
      } catch {
        setFilesCount(null);
      }

      if (repo.latest_job_status && (IN_PROGRESS_STATUSES as readonly string[]).includes(repo.latest_job_status)) {
        const job = await api.getIndexJob(id);
        setIndexJob(job);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Repository not found');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [id]);


  const isIndexing = Boolean(
    repository?.latest_job_status &&
    (IN_PROGRESS_STATUSES as readonly string[]).includes(repository.latest_job_status)
  );

  React.useEffect(() => {
    loadData();

    const handleScenarioChange = () => {
      loadData();
    };
    window.addEventListener('scenario-change', handleScenarioChange);
    return () => window.removeEventListener('scenario-change', handleScenarioChange);
  }, [loadData]);

  React.useEffect(() => {
    if (!isIndexing) return;
    const interval = setInterval(() => {
      loadData(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [isIndexing, loadData]);

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading repository details"
        className="p-6 max-w-7xl mx-auto space-y-6"
      >
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-[var(--radius-panel)]" />
          <Skeleton className="h-28 rounded-[var(--radius-panel)]" />
          <Skeleton className="h-28 rounded-[var(--radius-panel)]" />
          <Skeleton className="h-28 rounded-[var(--radius-panel)]" />
        </div>
        <Skeleton className="h-64 rounded-[var(--radius-panel)]" />
        <Skeleton className="h-48 rounded-[var(--radius-panel)]" />
      </div>
    );
  }

  if (error || !repository) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="p-12 text-center max-w-md mx-auto space-y-4"
      >
        <MaterialIcon name="error" size={32} className="text-[var(--color-error)] mx-auto" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Repository not found</h2>
        <p className="text-xs text-[var(--color-text-secondary)]">{error}</p>
        <Button variant="secondary" onClick={() => navigate('/repositories')}>
          Back to Repositories
        </Button>
      </div>
    );
  }

  const isFailed = repository.latest_job_status === 'FAILED';
  const progressPercent = indexJob?.progress?.percent ?? 64;
  const activeSha = repository.indexed_commit || repository.active_version_short_sha || '';


  return (
    <AnimatedPage className="min-h-full">
      {/* Sticky Repository Navigation Tabs */}
      <RepositoryHeader repository={repository} onRefresh={loadData} />

      <main className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="space-y-6">
          {/* Indexing Progress Banner (shown only when indexing is active) */}
          {isIndexing && (
            <Card className="border-[rgba(251,191,36,0.35)] bg-[var(--color-warning-tint)] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-warning)]">
                  <MaterialIcon name="sync" size={18} spin aria-hidden="true" />
                  <span>Repository Indexing in Progress</span>
                </div>
                <span className="font-mono text-xs font-semibold text-[var(--color-warning)]">
                  {progressPercent}%
                </span>
              </div>

              <div
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Indexing progress"
                className="h-2 w-full rounded-full bg-[var(--color-raised)] overflow-hidden"
              >
                <div
                  className="h-full bg-[var(--color-warning)] transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[var(--color-text-secondary)] gap-2">
                <div className="font-mono text-[11px] truncate">
                  Current phase: {indexJob?.progress?.phase ?? 'Analyzing code symbols and structure'}
                </div>
                <div className="text-[11px] text-[var(--color-muted)] font-mono">
                  Processed {indexJob?.progress?.files_processed ?? 256} of {indexJob?.progress?.files_total ?? 400} files
                </div>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                Analyzing repository structure and indexing symbols for instant search and code navigation.
              </p>
            </Card>
          )}

          {/* Concise Failure Diagnostic (avoids duplicating the header's retry action) */}
          {isFailed && indexJob?.failure_message && (
            <div className="p-3.5 px-4 rounded-lg border border-[rgba(248,113,113,0.35)] bg-[var(--color-error-tint)] flex items-start gap-3 text-xs text-[var(--color-error)]">
              <MaterialIcon name="error" size={18} fill={1} className="shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-0.5 min-w-0">
                <span className="font-semibold text-[var(--color-text)]">Indexing Failure Details:</span>{' '}
                <span className="text-[var(--color-text-secondary)]">{indexJob.failure_message}</span>
              </div>
            </div>
          )}

          {/* Repository Context Strip (Lightweight metadata, no duplicate headings or buttons) */}
          {repository.description && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/60 text-xs">
              <p className="text-[var(--color-text-secondary)] leading-relaxed max-w-3xl">
                {repository.description}
              </p>
              <div className="flex items-center gap-3 text-[var(--color-muted)] shrink-0 font-mono text-[11px]">
                {repository.language && (
                  <span className="flex items-center gap-1 text-[var(--color-text-secondary)]">
                    <MaterialIcon name="code" size={14} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                    <span>{repository.language}</span>
                  </span>
                )}
                {repository.last_indexed_at && (
                  <span className="flex items-center gap-1">
                    <MaterialIcon name="schedule" size={14} aria-hidden="true" />
                    <span>Indexed {formatRelativeTime(repository.last_indexed_at)}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 2. Compact Metric Cards with Contextual Explanations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1: Files Indexed */}
            <Card className="border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider inline-flex items-center gap-1 cursor-help">
                        Files Indexed
                        <MaterialIcon name="info" size={13} className="text-[var(--color-muted)] opacity-80" aria-hidden="true" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Source code files analyzed in this repository.
                    </TooltipContent>
                  </Tooltip>
                  <div className="text-2xl font-bold font-mono tracking-tight text-[var(--color-text)]">
                    {filesCount !== null ? formatNumber(filesCount) : '—'}
                  </div>
                  <span className="text-[11px] text-[var(--color-text-secondary)] block">
                    {filesCount !== null ? 'Tracked in active index' : 'Awaiting initial index'}
                  </span>
                </div>
                <div className="p-2.5 rounded-[var(--radius-control)] bg-[var(--color-mint-selected-bg,#253A32)] border border-[rgba(185,228,208,0.22)] shrink-0">
                  <MaterialIcon name="folder_open" size={22} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                </div>
              </CardContent>
            </Card>

            {/* Metric 2: Lines of Code */}
            <Card className="border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider inline-flex items-center gap-1 cursor-help">
                        Lines of Code
                        <MaterialIcon name="info" size={13} className="text-[var(--color-muted)] opacity-80" aria-hidden="true" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Total lines of code analyzed across repository files.
                    </TooltipContent>
                  </Tooltip>
                  <div className="text-2xl font-bold font-mono tracking-tight text-[var(--color-text)]">
                    {repository.lines_of_code !== undefined && repository.lines_of_code !== null
                      ? formatNumber(repository.lines_of_code)
                      : '—'}
                  </div>
                  <span className="text-[11px] text-[var(--color-text-secondary)] block">
                    Analyzed source code lines
                  </span>
                </div>
                <div className="p-2.5 rounded-[var(--radius-control)] bg-[var(--color-mint-selected-bg,#253A32)] border border-[rgba(185,228,208,0.22)] shrink-0">
                  <MaterialIcon name="data_object" size={22} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                </div>
              </CardContent>
            </Card>

            {/* Metric 3: Symbols Extracted */}
            <Card className="border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider inline-flex items-center gap-1 cursor-help">
                        Symbols
                        <MaterialIcon name="info" size={13} className="text-[var(--color-muted)] opacity-80" aria-hidden="true" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Functions, classes, and types identified for code search and navigation.
                    </TooltipContent>
                  </Tooltip>
                  <div className="text-2xl font-bold font-mono tracking-tight text-[var(--color-accent)]">
                    {repository.ast_nodes !== undefined && repository.ast_nodes !== null
                      ? formatNumber(repository.ast_nodes)
                      : '—'}
                  </div>
                  <span className="text-[11px] text-[var(--color-text-secondary)] block">
                    Classes, functions & types
                  </span>
                </div>
                <div className="p-2.5 rounded-[var(--radius-control)] bg-[var(--color-accent-tint)] border border-[var(--color-accent-border)] shrink-0">
                  <MaterialIcon name="hub" size={22} fill={1} className="text-[var(--color-accent)]" aria-hidden="true" />
                </div>
              </CardContent>
            </Card>

            {/* Metric 4: Indexing Freshness */}
            <Card className="border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider inline-flex items-center gap-1 cursor-help">
                        Latest Commit
                        <MaterialIcon name="info" size={13} className="text-[var(--color-muted)] opacity-80" aria-hidden="true" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      The active Git commit analyzed in this index.
                    </TooltipContent>
                  </Tooltip>
                  <div className="text-2xl font-bold font-mono tracking-tight text-[var(--color-text)] truncate">
                    {activeSha ? shortSha(activeSha) : 'Not indexed'}
                  </div>
                  <span className="text-[11px] text-[var(--color-text-secondary)] block truncate">
                    {repository.last_indexed_at ? formatRelativeTime(repository.last_indexed_at) : 'Awaiting sync'}
                  </span>
                </div>
                <div className="p-2.5 rounded-[var(--radius-control)] bg-[var(--color-raised)] border border-[var(--color-border)] shrink-0">
                  <MaterialIcon name="schedule" size={22} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Overview Analytics: Actual Graphs & Charts from shadcn */}
          <RepositoryAnalyticsCharts repository={repository} filesCount={filesCount} />

          {/* Index Commit History */}
          <Card className="border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-xs">
            <CardHeader className="p-4 border-b border-[var(--color-border)] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Commit History
                </CardTitle>
                <CardDescription className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  Recent git revisions analyzed for this repository.
                </CardDescription>
              </div>
            </CardHeader>

            {repository.index_history && repository.index_history.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[var(--color-border)] bg-[var(--color-raised)]/40">
                    <TableHead className="py-2.5 px-4">Commit SHA</TableHead>
                    <TableHead className="py-2.5 px-4">Commit Message</TableHead>
                    <TableHead className="py-2.5 px-4">Branch</TableHead>
                    <TableHead className="py-2.5 px-4">Status</TableHead>
                    <TableHead className="py-2.5 px-4">Symbols</TableHead>
                    <TableHead className="py-2.5 px-4">Indexed At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="font-mono text-[11px]">
                  {repository.index_history.map((entry) => (
                    <TableRow key={entry.sha}>
                      {/* Commit SHA with Copy Button */}
                      <TableCell className="py-2.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-semibold text-[var(--color-text)]">
                          <MaterialIcon name="commit" size={16} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                          <button
                            onClick={() => handleCopySha(entry.sha)}
                            className="group inline-flex items-center gap-1 hover:text-[var(--color-mint-accent,#B9E4D0)] transition cursor-pointer"
                            title={`Click to copy full commit SHA: ${entry.sha}`}
                            aria-label={`Copy commit SHA ${shortSha(entry.sha)}`}
                          >
                            <span>{shortSha(entry.sha)}</span>
                            {copiedSha === entry.sha ? (
                              <MaterialIcon name="check" size={14} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                            ) : (
                              <MaterialIcon name="content_copy" size={14} className="text-[var(--color-muted)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition-colors opacity-70" aria-hidden="true" />
                            )}
                          </button>
                          {entry.label && (
                            <Badge variant="accent" className="ml-1 text-[10px]">
                              {entry.label}
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Commit Message */}
                      <TableCell className="py-2.5 px-4 font-sans text-xs text-[var(--color-text-secondary)] max-w-xs truncate" title={entry.commit_message}>
                        {entry.commit_message}
                      </TableCell>

                      {/* Branch */}
                      <TableCell className="py-2.5 px-4 whitespace-nowrap text-[var(--color-text-secondary)] font-mono text-[11px]">
                        {repository.default_branch || 'main'}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-2.5 px-4 whitespace-nowrap">
                        {entry.status === 'READY' && (
                          <span className="inline-flex items-center gap-1 text-[var(--color-mint-accent,#B9E4D0)] font-medium">
                            <MaterialIcon name="check_circle" size={16} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                            <span>Ready</span>
                          </span>
                        )}
                        {entry.status === 'INDEXING' && (
                          <span className="inline-flex items-center gap-1 text-[var(--color-warning)] font-medium">
                            <MaterialIcon name="sync" size={16} spin aria-hidden="true" />
                            <span>Indexing</span>
                          </span>
                        )}
                        {entry.status === 'FAILED' && (
                          <span className="inline-flex items-center gap-1 text-[var(--color-error)] font-medium">
                            <MaterialIcon name="error" size={16} fill={1} aria-hidden="true" />
                            <span>Failed</span>
                          </span>
                        )}
                        {entry.status !== 'READY' && entry.status !== 'INDEXING' && entry.status !== 'FAILED' && (
                          <span className="text-[var(--color-muted)]">{entry.status}</span>
                        )}
                      </TableCell>

                      {/* Symbols Indexed */}
                      <TableCell className="py-2.5 px-4 whitespace-nowrap text-[var(--color-text-secondary)] font-mono">
                        {entry.symbols_indexed !== null && entry.symbols_indexed !== undefined
                          ? formatNumber(entry.symbols_indexed)
                          : '—'}
                      </TableCell>

                      {/* Indexed At */}
                      <TableCell
                        className="py-2.5 px-4 whitespace-nowrap text-[var(--color-muted)] font-mono text-[11px]"
                        title={new Date(entry.timestamp).toLocaleString()}
                      >
                        {formatRelativeTime(entry.timestamp)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center space-y-2">
                <MaterialIcon name="commit" size={28} className="text-[var(--color-muted)] mx-auto opacity-60" aria-hidden="true" />
                <p className="text-xs font-medium text-[var(--color-text)]">No commit indexing history available</p>
                <p className="text-[11px] text-[var(--color-muted)]">
                  Trigger a re-index to analyze and track git revisions.
                </p>
              </div>
            )}
          </Card>
        </div>
      </main>
    </AnimatedPage>
  );
}
