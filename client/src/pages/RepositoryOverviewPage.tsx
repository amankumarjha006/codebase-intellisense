import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  GitCommit,
  GitBranch,
  FolderGit2,
  Lock,
  Globe,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { api } from '../lib/api';
import { Repository, IndexJob } from '../lib/types';
import { formatNumber, formatRelativeTime, shortSha } from '../lib/utils';
import { RepositoryHeader } from '../components/repository/RepositoryHeader';
import { RepositoryNavDock } from '../components/repository/RepositoryNavDock';
import { StatusChip } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { AnimatedPage } from '../components/ui/AnimatedPage';

export function RepositoryOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [repository, setRepository] = React.useState<Repository | null>(null);
  const [indexJob, setIndexJob] = React.useState<IndexJob | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [copiedSha, setCopiedSha] = React.useState<string | null>(null);

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => {
      setCopiedSha((cur) => (cur === sha ? null : cur));
    }, 2000);
  };

  const loadData = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const repo = await api.getRepository(id);
      setRepository(repo);

      if (repo.latest_job_status === 'INDEXING' || repo.latest_job_status === 'QUEUED') {
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
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    loadData();

    const handleScenarioChange = () => {
      loadData();
    };
    window.addEventListener('scenario-change', handleScenarioChange);
    return () => window.removeEventListener('scenario-change', handleScenarioChange);
  }, [loadData]);

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40 rounded-[var(--radius-panel)]" />
          <Skeleton className="h-40 rounded-[var(--radius-panel)]" />
        </div>
        <Skeleton className="h-64 rounded-[var(--radius-panel)]" />
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
        <AlertCircle size={32} className="text-[var(--color-error)] mx-auto" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Repository not found</h2>
        <p className="text-xs text-[var(--color-text-secondary)]">{error}</p>
        <Button variant="secondary" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const isIndexing = repository.latest_job_status === 'INDEXING';
  const progressPercent = indexJob?.progress?.percent ?? 64;
  const activeSha = repository.indexed_commit || repository.active_version_short_sha || '';
  const repoStatus =
    repository.latest_job_status ||
    (activeSha ? 'READY' : 'NOT_INDEXED');

  return (
    <AnimatedPage className="min-h-full">
      {/* Slim Repository Header: Action Row (Re-index & GitHub) + Mobile Tab Strip */}
      <RepositoryHeader repository={repository} onRefresh={loadData} />

      <main className="p-6 max-w-7xl mx-auto">
        {/* Two-region Workspace Layout: Main Content Area + Sticky Vertical Navigation Dock */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Main Content Workspace Column */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Indexing Progress State Banner (shown only when indexing) */}
            {isIndexing && (
              <section
                aria-label="Repository indexing progress"
                className="p-5 rounded-[var(--radius-panel)] border border-[rgba(251,191,36,0.35)] bg-[var(--color-warning-tint)] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-warning)]">
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
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
                    Current phase: {indexJob?.progress?.phase ?? 'Indexing AST symbols & generating embeddings'}
                  </div>
                  <div className="text-[11px] text-[var(--color-muted)]">
                    Processed {indexJob?.progress?.files_processed ?? 256} of {indexJob?.progress?.files_total ?? 400} files
                  </div>
                </div>
              </section>
            )}

            {/* 1. Repository Summary Section */}
            <section
              aria-labelledby="repo-summary-heading"
              className="p-5 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      Repository Summary
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-2 text-[var(--color-text)]">
                      <FolderGit2 size={18} className="text-[var(--color-accent)] shrink-0" aria-hidden="true" />
                      <h1 id="repo-summary-heading" className="text-lg sm:text-xl font-bold tracking-tight text-[var(--color-text)]">
                        {repository.owner}/{repository.name}
                      </h1>
                    </div>
                    {repository.is_private ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-[var(--color-raised)] border border-[var(--color-border)] text-[var(--color-muted)]">
                        <Lock size={10} aria-hidden="true" />
                        <span>Private</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-[var(--color-raised)] border border-[var(--color-border)] text-[var(--color-muted)]">
                        <Globe size={10} aria-hidden="true" />
                        <span>Public</span>
                      </span>
                    )}
                  </div>
                  {repository.description && (
                    <p className="text-xs text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
                      {repository.description}
                    </p>
                  )}
                </div>

                {/* Indexing Status Badge */}
                <div className="shrink-0 self-start sm:self-center">
                  <StatusChip status={repoStatus} size="sm" />
                </div>
              </div>

              {/* Structured Metadata Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3.5 border-t border-[var(--color-border)]">
                {/* Branch */}
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--color-muted)] block">Branch</span>
                  <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-[var(--color-text)]">
                    <GitBranch size={13} className="text-[var(--color-accent)] shrink-0" aria-hidden="true" />
                    <span className="truncate">{repository.default_branch || 'main'}</span>
                  </div>
                </div>

                {/* Latest Indexed Commit */}
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--color-muted)] block">Latest Commit</span>
                  {activeSha ? (
                    <button
                      onClick={() => handleCopySha(activeSha)}
                      className="group inline-flex items-center gap-1.5 text-xs font-mono font-medium text-[var(--color-text)] hover:text-[var(--color-accent)] transition cursor-pointer"
                      title={`Click to copy full commit SHA: ${activeSha}`}
                      aria-label={`Copy commit SHA ${shortSha(activeSha)}`}
                    >
                      <GitCommit size={13} className="text-[var(--color-accent)] shrink-0" aria-hidden="true" />
                      <span>{shortSha(activeSha)}</span>
                      {copiedSha === activeSha ? (
                        <Check size={12} className="text-[var(--color-accent)]" aria-hidden="true" />
                      ) : (
                        <Copy size={12} className="text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    <span className="text-xs font-mono text-[var(--color-muted)]">—</span>
                  )}
                </div>

                {/* Last Indexed */}
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--color-muted)] block">Last Indexed</span>
                  <span
                    className="text-xs font-mono text-[var(--color-text-secondary)] block truncate"
                    title={repository.last_indexed_at ? new Date(repository.last_indexed_at).toLocaleString() : undefined}
                  >
                    {repository.last_indexed_at ? formatRelativeTime(repository.last_indexed_at) : 'Not indexed'}
                  </span>
                </div>

                {/* AST Symbol Nodes */}
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--color-muted)] block">AST Symbol Nodes</span>
                  <span className="text-xs font-mono font-semibold text-[var(--color-accent)] block">
                    {repository.ast_nodes !== undefined && repository.ast_nodes !== null
                      ? `${formatNumber(repository.ast_nodes)} symbols`
                      : '—'}
                  </span>
                </div>
              </div>
            </section>

            {/* 2. Indexing Metrics Section (Structured Details Table) */}
            <section
              aria-labelledby="metrics-heading"
              className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs overflow-hidden space-y-0"
            >
              <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
                <div>
                  <h2 id="metrics-heading" className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Indexing Metrics
                  </h2>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    Analyzed codebase properties, parsing grammar, and verification bounds.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse" aria-label="Repository indexing metrics">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-raised)]/40 text-[var(--color-muted)] font-medium">
                      <th scope="col" className="py-2.5 px-4 w-1/3">Property</th>
                      <th scope="col" className="py-2.5 px-4 w-1/3">Value</th>
                      <th scope="col" className="py-2.5 px-4 w-1/3 text-[var(--color-muted)] font-normal hidden sm:table-cell">Context / Scope</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] text-xs">
                    {/* Total Lines of Code */}
                    <tr className="hover:bg-[var(--color-raised)]/30 transition">
                      <td className="py-3 px-4 text-[var(--color-text-secondary)] font-medium">Total Lines of Code</td>
                      <td className="py-3 px-4 font-mono font-semibold text-[var(--color-text)]">
                        {repository.lines_of_code !== undefined && repository.lines_of_code !== null
                          ? formatNumber(repository.lines_of_code)
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-[var(--color-muted)] text-[11px] hidden sm:table-cell">
                        Analyzed source code lines across repository
                      </td>
                    </tr>

                    {/* AST Symbol Nodes */}
                    <tr className="hover:bg-[var(--color-raised)]/30 transition">
                      <td className="py-3 px-4 text-[var(--color-text-secondary)] font-medium">AST Symbol Nodes</td>
                      <td className="py-3 px-4 font-mono font-semibold text-[var(--color-accent)]">
                        {repository.ast_nodes !== undefined && repository.ast_nodes !== null
                          ? formatNumber(repository.ast_nodes)
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-[var(--color-muted)] text-[11px] hidden sm:table-cell">
                        Extracted classes, functions, methods & scopes
                      </td>
                    </tr>

                    {/* Primary Language */}
                    <tr className="hover:bg-[var(--color-raised)]/30 transition">
                      <td className="py-3 px-4 text-[var(--color-text-secondary)] font-medium">Primary Language</td>
                      <td className="py-3 px-4 font-mono font-semibold text-[var(--color-text)]">
                        {repository.language || 'Unknown'}
                      </td>
                      <td className="py-3 px-4 text-[var(--color-muted)] text-[11px] hidden sm:table-cell">
                        Tree-sitter parser grammar active for symbol indexing
                      </td>
                    </tr>

                    {/* Verification Scope */}
                    <tr className="hover:bg-[var(--color-raised)]/30 transition">
                      <td className="py-3 px-4 text-[var(--color-text-secondary)] font-medium">Verification Scope</td>
                      <td className="py-3 px-4 text-[var(--color-text)] font-medium">
                        {repository.verification_scope || 'Full repository'}
                      </td>
                      <td className="py-3 px-4 text-[var(--color-muted)] text-[11px] hidden sm:table-cell">
                        pgvector similarity search + reciprocal rank fusion
                      </td>
                    </tr>

                    {/* Indexed Branch */}
                    <tr className="hover:bg-[var(--color-raised)]/30 transition">
                      <td className="py-3 px-4 text-[var(--color-text-secondary)] font-medium">Indexed Branch</td>
                      <td className="py-3 px-4 font-mono text-[var(--color-text)] flex items-center gap-1.5">
                        <GitBranch size={12} className="text-[var(--color-accent)]" aria-hidden="true" />
                        <span>{repository.default_branch || 'main'}</span>
                      </td>
                      <td className="py-3 px-4 text-[var(--color-muted)] text-[11px] hidden sm:table-cell">
                        Target Git branch tracked for incremental analysis
                      </td>
                    </tr>

                    {/* Target Git Revision */}
                    <tr className="hover:bg-[var(--color-raised)]/30 transition">
                      <td className="py-3 px-4 text-[var(--color-text-secondary)] font-medium">Target Git Revision</td>
                      <td className="py-3 px-4 font-mono text-[var(--color-text)]">
                        {activeSha ? shortSha(activeSha) : '—'}
                      </td>
                      <td className="py-3 px-4 text-[var(--color-muted)] text-[11px] hidden sm:table-cell">
                        Commit SHA referenced by active vector store index
                      </td>
                    </tr>

                    {/* Last Verification Timestamp */}
                    <tr className="hover:bg-[var(--color-raised)]/30 transition">
                      <td className="py-3 px-4 text-[var(--color-text-secondary)] font-medium">Last Verified Timestamp</td>
                      <td className="py-3 px-4 font-mono text-xs text-[var(--color-text-secondary)]">
                        {repository.last_indexed_at ? new Date(repository.last_indexed_at).toLocaleString() : 'Unavailable'}
                      </td>
                      <td className="py-3 px-4 text-[var(--color-muted)] text-[11px] hidden sm:table-cell">
                        Completion timestamp of active indexed version
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 3. Index Commit History Section */}
            <section
              aria-labelledby="history-heading"
              className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-xs"
            >
              <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
                <div>
                  <h2 id="history-heading" className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Index Commit History
                  </h2>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    Record of git revisions analyzed into the vector index.
                  </p>
                </div>
              </div>

              {repository.index_history && repository.index_history.length > 0 ? (
                <div className="overflow-x-auto">
                  <table
                    className="w-full text-left text-xs border-collapse"
                    aria-label="Index commit history"
                  >
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-raised)]/40 text-[var(--color-muted)] font-medium">
                        <th scope="col" className="py-2.5 px-4">Commit SHA</th>
                        <th scope="col" className="py-2.5 px-4">Commit Message</th>
                        <th scope="col" className="py-2.5 px-4">Branch</th>
                        <th scope="col" className="py-2.5 px-4">Status</th>
                        <th scope="col" className="py-2.5 px-4">Symbols</th>
                        <th scope="col" className="py-2.5 px-4">Indexed At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)] font-mono text-[11px]">
                      {repository.index_history.map((entry) => (
                        <tr key={entry.sha} className="hover:bg-[var(--color-raised)]/30 transition">
                          {/* Commit SHA with Copy Button */}
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-semibold text-[var(--color-text)]">
                              <GitCommit size={13} className="text-[var(--color-accent)]" aria-hidden="true" />
                              <button
                                onClick={() => handleCopySha(entry.sha)}
                                className="group inline-flex items-center gap-1 hover:text-[var(--color-accent)] transition cursor-pointer"
                                title={`Click to copy full commit SHA: ${entry.sha}`}
                                aria-label={`Copy commit SHA ${shortSha(entry.sha)}`}
                              >
                                <span>{shortSha(entry.sha)}</span>
                                {copiedSha === entry.sha ? (
                                  <Check size={11} className="text-[var(--color-accent)]" aria-hidden="true" />
                                ) : (
                                  <Copy size={11} className="text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors opacity-70" aria-hidden="true" />
                                )}
                              </button>
                              {entry.label && (
                                <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-accent-tint)] text-[var(--color-accent)] border border-[var(--color-accent-border)] font-sans">
                                  {entry.label}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Commit Message */}
                          <td className="py-2.5 px-4 font-sans text-xs text-[var(--color-text-secondary)] max-w-xs truncate" title={entry.commit_message}>
                            {entry.commit_message}
                          </td>

                          {/* Branch */}
                          <td className="py-2.5 px-4 whitespace-nowrap text-[var(--color-text-secondary)] font-mono text-[11px]">
                            {repository.default_branch || 'main'}
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            {entry.status === 'READY' && (
                              <span className="inline-flex items-center gap-1 text-[var(--color-accent)] font-medium">
                                <CheckCircle2 size={12} aria-hidden="true" />
                                <span>Ready</span>
                              </span>
                            )}
                            {entry.status === 'INDEXING' && (
                              <span className="inline-flex items-center gap-1 text-[var(--color-warning)] font-medium">
                                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                                <span>Indexing</span>
                              </span>
                            )}
                            {entry.status === 'FAILED' && (
                              <span className="inline-flex items-center gap-1 text-[var(--color-error)] font-medium">
                                <AlertCircle size={12} aria-hidden="true" />
                                <span>Failed</span>
                              </span>
                            )}
                            {entry.status !== 'READY' && entry.status !== 'INDEXING' && entry.status !== 'FAILED' && (
                              <span className="text-[var(--color-muted)]">{entry.status}</span>
                            )}
                          </td>

                          {/* Symbols Indexed */}
                          <td className="py-2.5 px-4 whitespace-nowrap text-[var(--color-text-secondary)] font-mono">
                            {entry.symbols_indexed !== null && entry.symbols_indexed !== undefined
                              ? `${formatNumber(entry.symbols_indexed)}`
                              : '—'}
                          </td>

                          {/* Indexed At */}
                          <td
                            className="py-2.5 px-4 whitespace-nowrap text-[var(--color-muted)] font-mono text-[11px]"
                            title={new Date(entry.timestamp).toLocaleString()}
                          >
                            {formatRelativeTime(entry.timestamp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center space-y-2">
                  <GitCommit size={24} className="text-[var(--color-muted)] mx-auto opacity-60" aria-hidden="true" />
                  <p className="text-xs font-medium text-[var(--color-text)]">No commit indexing history available</p>
                  <p className="text-[11px] text-[var(--color-muted)]">
                    Trigger a re-index to analyze and track git revisions.
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Sleek Floating Sticky Navigation Dock (Desktop lg+) */}
          <aside
            aria-label="Repository navigation dock"
            className="hidden lg:block sticky top-6 shrink-0 z-10"
          >
            <RepositoryNavDock repoId={repository.id} orientation="vertical" />
          </aside>
        </div>
      </main>
    </AnimatedPage>
  );
}
