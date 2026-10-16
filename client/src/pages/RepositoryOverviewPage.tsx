import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  GitCommit,
  Layers,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  FolderTree,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { api } from '../lib/api';
import { Repository, IndexJob } from '../lib/types';
import { formatNumber, formatRelativeTime, shortSha } from '../lib/utils';
import { RepositoryHeader } from '../components/repository/RepositoryHeader';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';

export function RepositoryOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [repository, setRepository] = React.useState<Repository | null>(null);
  const [indexJob, setIndexJob] = React.useState<IndexJob | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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
    } catch (err: any) {
      setError(err?.message || 'Repository not found');
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
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-[var(--radius-panel)]" />
          <Skeleton className="h-32 rounded-[var(--radius-panel)]" />
          <Skeleton className="h-32 rounded-[var(--radius-panel)]" />
        </div>
      </div>
    );
  }

  if (error || !repository) {
    return (
      <div className="p-12 text-center max-w-md mx-auto space-y-4">
        <AlertCircle size={32} className="text-[var(--color-error)] mx-auto" />
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Repository not found</h2>
        <p className="text-xs text-[var(--color-text-secondary)]">{error}</p>
        <Button variant="secondary" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const isIndexing = repository.latest_job_status === 'INDEXING';

  return (
    <div className="min-h-full">
      <RepositoryHeader repository={repository} onRefresh={loadData} />

      <div className="p-6 max-w-7xl mx-auto space-y-8">
        {/* Indexing Progress State Banner */}
        {isIndexing && (
          <div className="p-6 rounded-[var(--radius-panel)] border border-[rgba(251,191,36,0.35)] bg-[var(--color-warning-tint)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-warning)]">
                <Loader2 size={16} className="animate-spin" />
                <span>Repository Indexing in Progress</span>
              </div>
              <span className="font-mono text-xs font-semibold text-[var(--color-warning)]">
                {indexJob?.progress?.percent ?? 64}%
              </span>
            </div>

            <div className="h-2 w-full rounded-full bg-[var(--color-raised)] overflow-hidden">
              <div
                className="h-full bg-[var(--color-warning)] transition-all duration-300"
                style={{ width: `${indexJob?.progress?.percent ?? 64}%` }}
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
          </div>
        )}

        {/* Quick Surface Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => navigate(`/repositories/${repository.id}/chat`)}
            className="p-5 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] transition cursor-pointer group space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-8 w-8 rounded-lg bg-[var(--color-raised)] flex items-center justify-center text-[var(--color-accent)]">
                <MessageSquare size={16} />
              </div>
              <ArrowRight size={14} className="text-[var(--color-muted)] group-hover:text-[var(--color-text)] transition-transform group-hover:translate-x-1" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text)]">Repository Q&A</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Ask questions about code structure, interfaces, logic flow, and dependencies with verbatim citations.
              </p>
            </div>
          </div>

          <div
            onClick={() => navigate(`/repositories/${repository.id}/architecture`)}
            className="p-5 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] transition cursor-pointer group space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-8 w-8 rounded-lg bg-[var(--color-raised)] flex items-center justify-center text-[var(--color-accent)]">
                <Layers size={16} />
              </div>
              <ArrowRight size={14} className="text-[var(--color-muted)] group-hover:text-[var(--color-text)] transition-transform group-hover:translate-x-1" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text)]">Architecture & Pipeline</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                View synthesized system modules, topological diagrams, and request execution pipelines.
              </p>
            </div>
          </div>

          <div
            onClick={() => navigate(`/repositories/${repository.id}/files`)}
            className="p-5 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] transition cursor-pointer group space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-8 w-8 rounded-lg bg-[var(--color-raised)] flex items-center justify-center text-[var(--color-accent)]">
                <FolderTree size={16} />
              </div>
              <ArrowRight size={14} className="text-[var(--color-muted)] group-hover:text-[var(--color-text)] transition-transform group-hover:translate-x-1" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text)]">File & AST Browser</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Browse file trees with syntax highlighting, AST anchors, line number gutters, and symbols.
              </p>
            </div>
          </div>
        </div>

        {/* Codebase Volume & Verification Scope */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <span className="text-xs text-[var(--color-muted)] block">Total Lines of Code</span>
            <span className="text-xl font-bold font-mono text-[var(--color-text)] mt-1 block">
              {formatNumber(repository.lines_of_code)}
            </span>
            <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 block">
              Analyzed source lines
            </span>
          </div>

          <div className="p-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <span className="text-xs text-[var(--color-muted)] block">AST Symbol Nodes</span>
            <span className="text-xl font-bold font-mono text-[var(--color-accent)] mt-1 block">
              {formatNumber(repository.ast_nodes)}
            </span>
            <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 block">
              Classes, functions & scopes
            </span>
          </div>

          <div className="p-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <span className="text-xs text-[var(--color-muted)] block">Primary Language</span>
            <span className="text-xl font-bold font-mono text-[var(--color-text)] mt-1 block">
              {repository.language}
            </span>
            <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 block">
              Tree-sitter grammar active
            </span>
          </div>

          <div className="p-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <span className="text-xs text-[var(--color-muted)] block">Verification Scope</span>
            <span className="text-sm font-semibold text-[var(--color-text)] mt-1 block truncate">
              {repository.verification_scope}
            </span>
            <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 block">
              pgvector + full text RRF
            </span>
          </div>
        </div>

        {/* Index History Table */}
        <div className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Index Commit History</h2>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Record of git revisions analyzed into the vector index.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-raised)]/50 text-[var(--color-muted)] font-medium">
                  <th className="py-2.5 px-4">Commit SHA</th>
                  <th className="py-2.5 px-4">Message</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Symbols</th>
                  <th className="py-2.5 px-4">Indexed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] font-mono text-[11px]">
                {repository.index_history.map((entry) => (
                  <tr key={entry.sha} className="hover:bg-[var(--color-raised)]/40 transition">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 font-semibold text-[var(--color-text)]">
                        <GitCommit size={14} className="text-[var(--color-accent)]" />
                        <span>{shortSha(entry.sha)}</span>
                        {entry.label && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-accent-tint)] text-[var(--color-accent)] border border-[var(--color-accent-border)] font-sans">
                            {entry.label}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-sans text-xs text-[var(--color-text-secondary)] max-w-sm truncate">
                      {entry.commit_message}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {entry.status === 'READY' && (
                        <span className="inline-flex items-center gap-1 text-[var(--color-accent)]">
                          <CheckCircle2 size={12} />
                          <span>Ready</span>
                        </span>
                      )}
                      {entry.status === 'INDEXING' && (
                        <span className="inline-flex items-center gap-1 text-[var(--color-warning)]">
                          <Loader2 size={12} className="animate-spin" />
                          <span>Indexing</span>
                        </span>
                      )}
                      {entry.status === 'FAILED' && (
                        <span className="inline-flex items-center gap-1 text-[var(--color-error)]">
                          <AlertCircle size={12} />
                          <span>Failed</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-[var(--color-text-secondary)]">
                      {entry.symbols_indexed ? `${formatNumber(entry.symbols_indexed)} symbols` : '—'}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-[var(--color-muted)]">
                      {formatRelativeTime(entry.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
