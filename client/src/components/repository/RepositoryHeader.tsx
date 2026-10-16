import * as React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import {
  GitBranch,
  Copy,
  Check,
  RefreshCw,
  MessageSquare,
  Layers,
  Search,
  FolderTree,
  FileText,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Repository } from '../../lib/types';
import { StatusChip } from '../ui/badge';
import { Button } from '../ui/button';
import { formatRelativeTime, shortSha } from '../../lib/utils';
import { api } from '../../lib/api';

interface RepositoryHeaderProps {
  repository: Repository;
  onRefresh?: () => void;
}

export function RepositoryHeader({ repository, onRefresh }: RepositoryHeaderProps) {
  const [copied, setCopied] = React.useState(false);
  const [reindexing, setReindexing] = React.useState(false);

  const handleCopySha = () => {
    if (repository.indexed_commit) {
      navigator.clipboard.writeText(repository.indexed_commit);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    try {
      await api.reindexRepository(repository.id);
      onRefresh?.();
    } finally {
      setTimeout(() => setReindexing(false), 800);
    }
  };

  const basePath = `/repositories/${repository.id}`;

  const navTabs = [
    { name: 'Overview', path: basePath, icon: FileText, exact: true },
    { name: 'Chat', path: `${basePath}/chat`, icon: MessageSquare },
    { name: 'Architecture', path: `${basePath}/architecture`, icon: Layers },
    { name: 'Search', path: `${basePath}/search`, icon: Search },
    { name: 'Files', path: `${basePath}/files`, icon: FolderTree },
  ];

  return (
    <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/60">
      {/* Fallback version alert banner if latest indexing failed */}
      {repository.latest_job_status === 'FAILED' && (
        <div className="px-6 py-2.5 bg-[var(--color-warning-tint)] border-b border-[rgba(251,191,36,0.3)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-[var(--color-warning)]">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>
              Latest indexing job failed. You are currently querying the active verified fallback commit{' '}
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
            className="h-7 text-xs border-[rgba(251,191,36,0.4)] text-[var(--color-text)] hover:bg-[var(--color-warning-tint)]"
          >
            <RefreshCw size={12} className={reindexing ? 'animate-spin' : ''} />
            <span>Retry Indexing</span>
          </Button>
        </div>
      )}

      {/* Main Header Bar */}
      <div className="p-6 max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-text)] flex items-center gap-2">
              <span>{repository.owner}/{repository.name}</span>
            </h1>
            <StatusChip status={repository.latest_job_status} size="md" />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-muted)] font-mono">
            <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
              <GitBranch size={13} className="text-[var(--color-accent)]" />
              <span>{repository.default_branch}</span>
            </div>

            {repository.indexed_commit && (
              <>
                <span>•</span>
                <button
                  onClick={handleCopySha}
                  className="flex items-center gap-1 hover:text-[var(--color-text)] transition"
                  title="Click to copy full commit SHA"
                >
                  <span>sha: {shortSha(repository.indexed_commit)}</span>
                  {copied ? <Check size={12} className="text-[var(--color-accent)]" /> : <Copy size={12} />}
                </button>
              </>
            )}

            {repository.last_indexed_at && (
              <>
                <span>•</span>
                <span>Indexed {formatRelativeTime(repository.last_indexed_at)}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReindex}
            disabled={reindexing}
          >
            <RefreshCw size={13} className={reindexing ? 'animate-spin' : ''} />
            <span>Re-index repository</span>
          </Button>
          <a
            href={`https://github.com/${repository.owner}/${repository.name}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-control)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)] transition"
          >
            <span>GitHub</span>
            <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-6 max-w-7xl mx-auto flex items-center gap-1 border-t border-[var(--color-border)] overflow-x-auto no-scrollbar">
        {navTabs.map((tab) => (
          <NavLink
            key={tab.name}
            to={tab.path}
            end={tab.exact}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-[var(--color-accent)] text-[var(--color-text)] font-semibold'
                  : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text-secondary)]'
              }`
            }
          >
            <tab.icon size={14} />
            <span>{tab.name}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
