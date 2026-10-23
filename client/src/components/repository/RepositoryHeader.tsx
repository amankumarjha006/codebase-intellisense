import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Repository } from '../../lib/types';
import { Button } from '../ui/button';
import { MaterialIcon } from '../ui/MaterialIcon';
import { GithubIcon } from '../ui/GithubIcon';
import { StatusChip } from '../ui/badge';
import { shortSha, cn } from '../../lib/utils';
import { api } from '../../lib/api';

interface RepositoryHeaderProps {
  repository: Repository;
  onRefresh?: () => void;
}

export function RepositoryHeader({ repository, onRefresh }: RepositoryHeaderProps) {
  const location = useLocation();
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

  const activeSha = repository.indexed_commit || repository.active_version_short_sha || '';
  const repoStatus =
    repository.latest_job_status ||
    (activeSha ? 'READY' : 'NOT_INDEXED');

  const basePath = `/repositories/${repository.id}`;
  const currentPath = location.pathname;

  const navItems = [
    {
      name: 'Overview',
      path: basePath,
      iconName: 'description',
      isActive: currentPath === basePath || currentPath === `${basePath}/`,
    },
    {
      name: 'Chat',
      path: `${basePath}/chat`,
      iconName: 'chat',
      isActive: currentPath.startsWith(`${basePath}/chat`),
    },
    {
      name: 'Architecture',
      path: `${basePath}/architecture`,
      iconName: 'account_tree',
      isActive: currentPath.startsWith(`${basePath}/architecture`),
    },
    {
      name: 'Search',
      path: `${basePath}/search`,
      iconName: 'find_in_page',
      isActive: currentPath.startsWith(`${basePath}/search`),
    },
    {
      name: 'Files',
      path: `${basePath}/files`,
      iconName: 'folder_open',
      isActive: currentPath.startsWith(`${basePath}/files`),
    },
  ];

  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur-md sticky top-0 z-30">
      {/* Alert Banner when latest indexing job failed */}
      {repository.latest_job_status === 'FAILED' && (
        <div
          role="alert"
          aria-live="polite"
          className="px-4 sm:px-6 py-2 bg-[var(--color-warning-tint)] border-b border-[rgba(251,191,36,0.3)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-[var(--color-warning)]"
        >
          <div className="flex items-center gap-2">
            <MaterialIcon name="warning" size={18} fill={1} className="text-[var(--color-warning)]" aria-hidden="true" />
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
            <MaterialIcon name="sync" size={16} spin={reindexing} aria-hidden="true" />
            <span>Retry Indexing</span>
          </Button>
        </div>
      )}

      {/* Main Header Row: Repository Identity + Actions */}
      <div className="px-4 sm:px-6 py-3 max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Left: Repository Identity */}
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            className="h-9 w-9 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border-strong)] flex items-center justify-center text-[var(--color-mint-accent,#B9E4D0)] shrink-0 mt-0.5 sm:mt-0"
            aria-hidden="true"
          >
            <MaterialIcon name="folder" size={22} fill={1} color="var(--color-mint-accent, #B9E4D0)" />
          </div>

          <div className="flex flex-col min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--color-text)] flex items-center gap-1.5 truncate">
                <span className="text-[var(--color-muted)] font-normal">{repository.owner} /</span>
                <span className="truncate">{repository.name}</span>
              </h1>

              {repository.is_private ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-raised)] border border-[var(--color-border)] text-[var(--color-muted)] shrink-0">
                  <MaterialIcon name="lock" size={12} aria-hidden="true" />
                  <span>Private</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-raised)] border border-[var(--color-border)] text-[var(--color-muted)] shrink-0">
                  <MaterialIcon name="public" size={12} aria-hidden="true" />
                  <span>Public</span>
                </span>
              )}

              <div className="shrink-0">
                <StatusChip status={repoStatus} size="sm" />
              </div>
            </div>

            {/* Sub-identity Metadata: Branch & Commit */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-secondary)] font-mono">
              <span className="inline-flex items-center gap-1">
                <MaterialIcon name="call_split" size={14} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                <span>{repository.default_branch || 'main'}</span>
              </span>

              {activeSha && (
                <span className="inline-flex items-center gap-1 text-[var(--color-muted)]">
                  <MaterialIcon name="commit" size={14} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                  <span className="text-[var(--color-text)] font-semibold">{shortSha(activeSha)}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Repository Actions (Visually Distinct) */}
        <div className="flex items-center gap-2 shrink-0 self-start md:self-center pt-1 md:pt-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReindex}
            disabled={reindexing}
            aria-label="Re-index repository"
            className="h-8 text-xs font-medium"
          >
            <MaterialIcon name="sync" size={16} spin={reindexing} aria-hidden="true" />
            <span>Re-index</span>
          </Button>

          <a
            href={`https://github.com/${repository.owner}/${repository.name}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${repository.owner}/${repository.name} on GitHub`}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[var(--radius-control)] border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)] transition"
          >
            <GithubIcon size={15} aria-hidden="true" />
            <span className="hidden sm:inline">GitHub</span>
            <MaterialIcon name="open_in_new" size={14} className="text-[var(--color-muted)]" aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Repository Horizontal Navigation Bar */}
      <nav
        aria-label="Repository sections"
        className="px-4 sm:px-6 max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-[var(--color-border)]/60 pt-1 pb-1"
      >
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            aria-current={item.isActive ? 'page' : undefined}
            className={cn(
              'group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors select-none',
              item.isActive
                ? 'bg-[var(--color-mint-selected-bg,#253A32)] text-[var(--color-mint-accent,#B9E4D0)] font-semibold border border-[rgba(185,228,208,0.22)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60'
            )}
          >
            <MaterialIcon
              name={item.iconName}
              active={item.isActive}
              size={20}
              className={cn(
                'shrink-0 transition-colors',
                !item.isActive && 'group-hover:text-[var(--color-mint-hover,#D0F1E0)]'
              )}
              aria-hidden={true}
            />
            <span className={item.isActive ? 'text-[var(--color-mint-accent,#B9E4D0)] font-semibold' : undefined}>
              {item.name}
            </span>
          </Link>
        ))}
      </nav>
    </header>
  );
}
