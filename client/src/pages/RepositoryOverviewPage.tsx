import * as React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { api } from '../lib/api';
import { Repository, IndexJob } from '../lib/types';
import { IN_PROGRESS_STATUSES } from '../lib/status';
import { formatNumber, formatRelativeTime, shortSha } from '../lib/utils';
import { RepositoryHeader } from '../components/repository/RepositoryHeader';
import { Badge, StatusChip } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '../components/ui/table';
import { Separator } from '../components/ui/separator';
import { Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip';
import { AnimatedPage } from '../components/ui/AnimatedPage';
import { RepositoryAnalyticsCharts } from '../components/repository/RepositoryAnalyticsCharts';

export function RepositoryOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [repository, setRepository] = React.useState<Repository | null>(null);
  const [indexJob, setIndexJob] = React.useState<IndexJob | null>(null);
  const [filesCount, setFilesCount] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [copiedSha, setCopiedSha] = React.useState<string | null>(null);
  const [reindexing, setReindexing] = React.useState(false);

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
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

  const handleReindex = async () => {
    if (!id) return;
    setReindexing(true);
    try {
      await api.reindexRepository(id);
      await loadData();
    } catch (err) {
      console.error('Failed to trigger re-index:', err);
    } finally {
      setTimeout(() => setReindexing(false), 800);
    }
  };

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
        <Button variant="secondary" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const isFailed = repository.latest_job_status === 'FAILED';
  const progressPercent = indexJob?.progress?.percent ?? 64;
  const activeSha = repository.indexed_commit || repository.active_version_short_sha || '';
  const repoStatus =
    repository.latest_job_status ||
    (activeSha ? 'READY' : 'NOT_INDEXED');

  const githubUrl = `https://github.com/${repository.owner}/${repository.name}`;

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
                  Current phase: {indexJob?.progress?.phase ?? 'Extracting AST symbols & generating embeddings'}
                </div>
                <div className="text-[11px] text-[var(--color-muted)] font-mono">
                  Processed {indexJob?.progress?.files_processed ?? 256} of {indexJob?.progress?.files_total ?? 400} files
                </div>
              </div>
            </Card>
          )}

          {/* Failure Alert Banner (shown when latest indexing failed) */}
          {isFailed && (
            <Card className="border-[rgba(248,113,113,0.35)] bg-[var(--color-error-tint)] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <MaterialIcon name="error" size={22} fill={1} className="text-[var(--color-error)] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-error)]">
                    Latest Indexing Job Failed
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    {indexJob?.failure_message || 'An error occurred during repository ingestion. You can retry indexing or query previously indexed commits.'}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleReindex}
                disabled={reindexing}
                className="shrink-0 border-[rgba(248,113,113,0.4)] text-[var(--color-text)] hover:bg-[var(--color-error-tint)] gap-1.5"
              >
                <MaterialIcon name="sync" size={16} spin={reindexing} aria-hidden="true" />
                <span>Retry Indexing</span>
              </Button>
            </Card>
          )}

          {/* 1. Repository Summary Card */}
          <Card className="border-[var(--color-border)] bg-[var(--color-surface)]">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      Repository Identity
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-2 text-[var(--color-text)]">
                      <MaterialIcon name="folder" size={24} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-text)]">
                        {repository.owner}/{repository.name}
                      </h1>
                    </div>
                    {repository.is_private ? (
                      <Badge variant="outline" className="gap-1 text-[11px] text-[var(--color-muted)]">
                        <MaterialIcon name="lock" size={12} aria-hidden="true" />
                        <span>Private</span>
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-[11px] text-[var(--color-muted)]">
                        <MaterialIcon name="public" size={12} aria-hidden="true" />
                        <span>Public</span>
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] max-w-3xl leading-relaxed">
                    {repository.description ||
                      'Production repository connected for AST symbol indexing, vector retrieval, and grounded Q&A.'}
                  </p>
                </div>

                {/* Status & Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <StatusChip status={repoStatus} size="sm" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReindex}
                    disabled={reindexing || isIndexing}
                    className="h-8 text-xs gap-1.5"
                    title="Re-analyze repository and update vector index"
                  >
                    <MaterialIcon name="sync" size={14} spin={reindexing} aria-hidden="true" />
                    <span>Re-index</span>
                  </Button>
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)] transition"
                    title="View on GitHub"
                  >
                    <MaterialIcon name="open_in_new" size={14} aria-hidden="true" />
                    <span>GitHub</span>
                  </a>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <Separator className="mb-4" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                {/* Branch */}
                <div>
                  <span className="text-[11px] font-medium text-[var(--color-muted)] block mb-1">Tracked Branch</span>
                  <div className="flex items-center gap-1.5 font-mono font-medium text-[var(--color-text)]">
                    <MaterialIcon name="call_split" size={16} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                    <span className="truncate">{repository.default_branch || 'main'}</span>
                  </div>
                </div>

                {/* Active Revision */}
                <div>
                  <span className="text-[11px] font-medium text-[var(--color-muted)] block mb-1">Target Revision</span>
                  {activeSha ? (
                    <button
                      onClick={() => handleCopySha(activeSha)}
                      className="group inline-flex items-center gap-1.5 font-mono font-medium text-[var(--color-text)] hover:text-[var(--color-mint-accent,#B9E4D0)] transition cursor-pointer"
                      title={`Click to copy commit SHA: ${activeSha}`}
                      aria-label={`Copy commit SHA ${shortSha(activeSha)}`}
                    >
                      <MaterialIcon name="commit" size={16} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                      <span>{shortSha(activeSha)}</span>
                      {copiedSha === activeSha ? (
                        <MaterialIcon name="check" size={14} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                      ) : (
                        <MaterialIcon name="content_copy" size={14} className="text-[var(--color-muted)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition-colors opacity-75" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    <span className="font-mono text-[var(--color-muted)]">—</span>
                  )}
                </div>

                {/* Last Indexed */}
                <div>
                  <span className="text-[11px] font-medium text-[var(--color-muted)] block mb-1">Last Indexed</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-mono text-[var(--color-text-secondary)] block truncate cursor-help">
                        {repository.last_indexed_at ? formatRelativeTime(repository.last_indexed_at) : 'Not indexed'}
                      </span>
                    </TooltipTrigger>
                    {repository.last_indexed_at && (
                      <TooltipContent>
                        {new Date(repository.last_indexed_at).toLocaleString()}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </div>

                {/* Primary Language */}
                <div>
                  <span className="text-[11px] font-medium text-[var(--color-muted)] block mb-1">Primary Language</span>
                  <div className="flex items-center gap-1.5 font-mono text-[var(--color-text)]">
                    <MaterialIcon name="code" size={16} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                    <span>{repository.language || 'TypeScript'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Compact Metric Cards (Derived strictly from real backend values) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1: Files Indexed */}
            <Card className="border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider block">
                    Files Indexed
                  </span>
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
                  <span className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider block">
                    Lines of Code
                  </span>
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
                  <span className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider block">
                    Symbols Extracted
                  </span>
                  <div className="text-2xl font-bold font-mono tracking-tight text-[var(--color-accent)]">
                    {repository.ast_nodes !== undefined && repository.ast_nodes !== null
                      ? formatNumber(repository.ast_nodes)
                      : '—'}
                  </div>
                  <span className="text-[11px] text-[var(--color-text-secondary)] block">
                    AST classes, functions & types
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
                  <span className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider block">
                    Current Revision
                  </span>
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

          {/* 3. "Where should I go next to understand the code?" (Codebase Discovery Next Steps) */}
          <section aria-labelledby="discovery-heading" className="space-y-3">
            <div>
              <h2 id="discovery-heading" className="text-sm font-semibold tracking-tight text-[var(--color-text)]">
                Next Steps for Code Understanding
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Quick entry points to inspect system architecture, ask grounded questions, search symbols, or browse files.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Option 1: Architecture */}
              <Link to={`/repositories/${repository.id}/architecture`} className="group">
                <Card className="h-full border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-raised)]/40 transition flex flex-col justify-between">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-[var(--radius-control)] bg-[var(--color-mint-selected-bg,#253A32)] border border-[rgba(185,228,208,0.22)] w-fit">
                        <MaterialIcon name="account_tree" size={20} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                      </div>
                      <MaterialIcon name="arrow_forward" size={16} className="text-[var(--color-muted)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-sm font-semibold text-[var(--color-text)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition mt-2">
                      System Architecture
                    </CardTitle>
                    <CardDescription className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                      Explore synthesized component layers, design decisions, and data pipelines.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <span className="text-[11px] font-medium text-[var(--color-mint-accent,#B9E4D0)]">
                      Explore Architecture &rarr;
                    </span>
                  </CardContent>
                </Card>
              </Link>

              {/* Option 2: Grounded Chat */}
              <Link to={`/repositories/${repository.id}/chat`} className="group">
                <Card className="h-full border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-raised)]/40 transition flex flex-col justify-between">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-[var(--radius-control)] bg-[var(--color-mint-selected-bg,#253A32)] border border-[rgba(185,228,208,0.22)] w-fit">
                        <MaterialIcon name="chat" size={20} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                      </div>
                      <MaterialIcon name="arrow_forward" size={16} className="text-[var(--color-muted)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-sm font-semibold text-[var(--color-text)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition mt-2">
                      Codebase Q&A Chat
                    </CardTitle>
                    <CardDescription className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                      Ask questions with verifiable citations pointing directly to line ranges in source control.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <span className="text-[11px] font-medium text-[var(--color-mint-accent,#B9E4D0)]">
                      Open Chat &rarr;
                    </span>
                  </CardContent>
                </Card>
              </Link>

              {/* Option 3: Code Search */}
              <Link to={`/repositories/${repository.id}/search`} className="group">
                <Card className="h-full border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-raised)]/40 transition flex flex-col justify-between">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-[var(--radius-control)] bg-[var(--color-mint-selected-bg,#253A32)] border border-[rgba(185,228,208,0.22)] w-fit">
                        <MaterialIcon name="find_in_page" size={20} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                      </div>
                      <MaterialIcon name="arrow_forward" size={16} className="text-[var(--color-muted)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-sm font-semibold text-[var(--color-text)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition mt-2">
                      Code & Symbol Search
                    </CardTitle>
                    <CardDescription className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                      Find functions, classes, and semantic patterns across indexed files with AST context.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <span className="text-[11px] font-medium text-[var(--color-mint-accent,#B9E4D0)]">
                      Search Code &rarr;
                    </span>
                  </CardContent>
                </Card>
              </Link>

              {/* Option 4: File Explorer */}
              <Link to={`/repositories/${repository.id}/files`} className="group">
                <Card className="h-full border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-raised)]/40 transition flex flex-col justify-between">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-[var(--radius-control)] bg-[var(--color-mint-selected-bg,#253A32)] border border-[rgba(185,228,208,0.22)] w-fit">
                        <MaterialIcon name="folder_open" size={20} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                      </div>
                      <MaterialIcon name="arrow_forward" size={16} className="text-[var(--color-muted)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-sm font-semibold text-[var(--color-text)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition mt-2">
                      File Tree Explorer
                    </CardTitle>
                    <CardDescription className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                      Browse the complete repository tree and inspect syntax-highlighted source code.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <span className="text-[11px] font-medium text-[var(--color-mint-accent,#B9E4D0)]">
                      Browse Files &rarr;
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </section>

          {/* 4. Technical Details Table */}
          <Card className="border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-xs">
            <CardHeader className="p-4 border-b border-[var(--color-border)]">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Technical Details & Grammar
              </CardTitle>
              <CardDescription className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Analyzed codebase properties, parsing grammar, and verification bounds.
              </CardDescription>
            </CardHeader>

            <Table>
              <TableHeader>
                <TableRow className="border-b border-[var(--color-border)] bg-[var(--color-raised)]/40">
                  <TableHead className="py-2.5 px-4 w-1/3">Property</TableHead>
                  <TableHead className="py-2.5 px-4 w-1/3">Value</TableHead>
                  <TableHead className="py-2.5 px-4 w-1/3 hidden sm:table-cell">Context / Scope</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {/* Total Lines of Code */}
                <TableRow>
                  <TableCell className="py-3 px-4 font-medium text-[var(--color-text-secondary)]">
                    Total Lines of Code
                  </TableCell>
                  <TableCell className="py-3 px-4 font-mono font-semibold text-[var(--color-text)]">
                    {repository.lines_of_code !== undefined && repository.lines_of_code !== null
                      ? formatNumber(repository.lines_of_code)
                      : '—'}
                  </TableCell>
                  <TableCell className="py-3 px-4 text-[var(--color-muted)] text-[11px] hidden sm:table-cell">
                    Analyzed source code lines across repository
                  </TableCell>
                </TableRow>

                {/* AST Symbol Nodes */}
                <TableRow>
                  <TableCell className="py-3 px-4 font-medium text-[var(--color-text-secondary)]">
                    AST Symbol Nodes
                  </TableCell>
                  <TableCell className="py-3 px-4 font-mono font-semibold text-[var(--color-accent)]">
                    {repository.ast_nodes !== undefined && repository.ast_nodes !== null
                      ? formatNumber(repository.ast_nodes)
                      : '—'}
                  </TableCell>
                  <TableCell className="py-3 px-4 text-[var(--color-muted)] text-[11px] hidden sm:table-cell">
                    Extracted classes, functions, methods & scopes
                  </TableCell>
                </TableRow>

                {/* Primary Language */}
                <TableRow>
                  <TableCell className="py-3 px-4 font-medium text-[var(--color-text-secondary)]">
                    Primary Language
                  </TableCell>
                  <TableCell className="py-3 px-4 font-mono font-semibold text-[var(--color-text)]">
                    {repository.language || 'TypeScript'}
                  </TableCell>
                  <TableCell className="py-3 px-4 text-[var(--color-muted)] text-[11px] hidden sm:table-cell">
                    Tree-sitter parser grammar active for symbol indexing
                  </TableCell>
                </TableRow>

                {/* Verification Scope */}
                <TableRow>
                  <TableCell className="py-3 px-4 font-medium text-[var(--color-text-secondary)]">
                    Verification Scope
                  </TableCell>
                  <TableCell className="py-3 px-4 text-[var(--color-text)] font-medium">
                    {repository.verification_scope || 'Full repository'}
                  </TableCell>
                  <TableCell className="py-3 px-4 text-[var(--color-muted)] text-[11px] hidden sm:table-cell">
                    pgvector similarity search + reciprocal rank fusion
                  </TableCell>
                </TableRow>

                {/* Indexed Branch */}
                <TableRow>
                  <TableCell className="py-3 px-4 font-medium text-[var(--color-text-secondary)]">
                    Indexed Branch
                  </TableCell>
                  <TableCell className="py-3 px-4 font-mono text-[var(--color-text)]">
                    <div className="flex items-center gap-1.5">
                      <MaterialIcon name="call_split" size={14} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                      <span>{repository.default_branch || 'main'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 px-4 text-[var(--color-muted)] text-[11px] hidden sm:table-cell">
                    Target Git branch tracked for incremental analysis
                  </TableCell>
                </TableRow>

                {/* Target Git Revision */}
                <TableRow>
                  <TableCell className="py-3 px-4 font-medium text-[var(--color-text-secondary)]">
                    Target Git Revision
                  </TableCell>
                  <TableCell className="py-3 px-4 font-mono text-[var(--color-text)]">
                    {activeSha ? (
                      <button
                        onClick={() => handleCopySha(activeSha)}
                        className="group inline-flex items-center gap-1.5 hover:text-[var(--color-mint-accent,#B9E4D0)] transition cursor-pointer"
                        title="Click to copy full commit SHA"
                      >
                        <span>{shortSha(activeSha)}</span>
                        {copiedSha === activeSha ? (
                          <MaterialIcon name="check" size={14} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                        ) : (
                          <MaterialIcon name="content_copy" size={14} className="text-[var(--color-muted)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition-colors opacity-70" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="py-3 px-4 text-[var(--color-muted)] text-[11px] hidden sm:table-cell">
                    Commit SHA referenced by active vector store index
                  </TableCell>
                </TableRow>

                {/* Last Indexed Timestamp */}
                <TableRow>
                  <TableCell className="py-3 px-4 font-medium text-[var(--color-text-secondary)]">
                    Last Indexed Timestamp
                  </TableCell>
                  <TableCell className="py-3 px-4 font-mono text-xs text-[var(--color-text-secondary)]">
                    {repository.last_indexed_at ? new Date(repository.last_indexed_at).toLocaleString() : 'Unavailable'}
                  </TableCell>
                  <TableCell className="py-3 px-4 text-[var(--color-muted)] text-[11px] hidden sm:table-cell">
                    Completion timestamp of active indexed version
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>

          {/* 5. Index Commit History */}
          <Card className="border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-xs">
            <CardHeader className="p-4 border-b border-[var(--color-border)] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Index Commit History
                </CardTitle>
                <CardDescription className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  Record of git revisions analyzed into the vector index.
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
