import * as React from 'react';
import {
  RefreshCw,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { Repository } from '../../lib/types';
import { Button } from '../ui/button';
import { shortSha } from '../../lib/utils';
import { api } from '../../lib/api';
import { RepositoryNavDock } from './RepositoryNavDock';

interface RepositoryHeaderProps {
  repository: Repository;
  onRefresh?: () => void;
}

export function RepositoryHeader({ repository, onRefresh }: RepositoryHeaderProps) {
  const [reindexing, setReindexing] = React.useState(false);

  const handleReindex = async () => {
    setReindexing(true);
    try {
      await api.reindexRepository(repository.id);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to re-index repository:', err);
    } finally {
      setTimeout(() => setReindexing(false), 800);
    }
  };

  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/40 backdrop-blur-xs">
      {/* Fallback version alert banner if latest indexing failed */}
      {repository.latest_job_status === 'FAILED' && (
        <div
          role="alert"
          aria-live="polite"
          className="px-6 py-2.5 bg-[var(--color-warning-tint)] border-b border-[rgba(251,191,36,0.3)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-[var(--color-warning)]"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" aria-hidden="true" />
            <span>
              Latest indexing job failed. Querying active fallback commit{' '}
              <span className="font-mono font-semibold">
                {repository.active_version_short_sha || shortSha(repository.indexed_commit || '')}
              </span>.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReindex}
            disabled={reindexing}
            aria-label="Retry indexing repository"
            className="h-7 text-xs border-[rgba(251,191,36,0.4)] text-[var(--color-text)] hover:bg-[var(--color-warning-tint)]"
          >
            <RefreshCw size={12} className={reindexing ? 'animate-spin' : ''} aria-hidden="true" />
            <span>Retry Indexing</span>
          </Button>
        </div>
      )}

      {/* Slim Top-Right Action Row & Mobile Tab Strip */}
      <div className="px-6 py-2.5 max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Mobile & Tablet: Horizontal Navigation Strip (< lg) */}
        <div className="lg:hidden flex-1 overflow-x-auto min-w-0">
          <RepositoryNavDock repoId={repository.id} orientation="horizontal" />
        </div>

        {/* Action Buttons: Re-index Repository and GitHub */}
        <div className="flex items-center justify-end gap-2 shrink-0 sm:ml-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReindex}
            disabled={reindexing}
            aria-label="Re-index repository"
            className="h-8 text-xs font-medium"
          >
            <RefreshCw size={13} className={reindexing ? 'animate-spin' : ''} aria-hidden="true" />
            <span>Re-index repository</span>
          </Button>

          <a
            href={`https://github.com/${repository.owner}/${repository.name}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${repository.owner}/${repository.name} on GitHub`}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-control)] border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)] transition"
          >
            <span>GitHub</span>
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        </div>
      </div>
    </header>
  );
}
