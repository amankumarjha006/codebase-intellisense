import { Link, useLocation } from 'react-router-dom';
import { Repository } from '../../lib/types';
import { Button } from '../ui/button';
import { MaterialIcon } from '../ui/MaterialIcon';
import { shortSha, cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { StatusChip } from '../ui/badge';
import { motion } from 'motion/react';
import * as React from 'react';
import { usePinnedRepos } from '../../lib/pinnedRepos';

interface RepositoryHeaderProps {
  repository: Repository;
  onRefresh?: () => void;
  hideRepoInfo?: boolean;
}

export function RepositoryHeader({
  repository,
  onRefresh,
  hideRepoInfo = false,
}: RepositoryHeaderProps) {
  const location = useLocation();
  const [reindexing, setReindexing] = React.useState(false);
  const { isPinned, togglePin } = usePinnedRepos();

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

  const basePath = `/repositories/${repository.id}`;
  const currentPath = location.pathname;
  const activeSha = repository.indexed_commit || repository.active_version_short_sha || '';
  const repoStatus = repository.latest_job_status || (activeSha ? 'READY' : 'NOT_INDEXED');
  const githubUrl = `https://github.com/${repository.owner}/${repository.name}`;

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
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-md sticky top-0 z-30 select-none">
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

      {/* Unified Repository Navigation & Action Bar */}
      <div className="px-4 sm:px-6 max-w-7xl mx-auto flex items-center justify-between gap-3 py-1.5">
        {/* Navigation Tabs */}
        <nav
          aria-label="Repository sections"
          className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5"
        >
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              state={location.state}
              aria-current={item.isActive ? 'page' : undefined}
              className={cn(
                'relative group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors select-none',
                item.isActive
                  ? 'text-[var(--color-mint-accent,#B9E4D0)] font-semibold'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/40'
              )}
            >
              {item.isActive && (
                <motion.div
                  layoutId="active-repo-tab-pill"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="absolute inset-0 rounded-lg bg-[var(--color-mint-selected-bg,#1B332A)] border border-[rgba(185,228,208,0.25)] shadow-xs"
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <MaterialIcon
                  name={item.iconName}
                  active={item.isActive}
                  size={16}
                  className={cn(
                    'shrink-0 transition-colors',
                    !item.isActive && 'group-hover:text-[var(--color-mint-hover,#D0F1E0)]'
                  )}
                  aria-hidden="true"
                />
                <span>{item.name}</span>
              </span>
            </Link>
          ))}
        </nav>

        {/* Revision Metadata & Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Consolidated Revision Pill (Branch @ Short-SHA) */}
          <div className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--color-raised)] border border-[var(--color-border)] text-xs font-mono text-[var(--color-text)] shrink-0">
            <MaterialIcon name="call_split" size={13} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
            <span className="truncate max-w-[120px]">{repository.default_branch || 'main'}</span>
            <span className="text-[var(--color-muted)] font-sans">@</span>
            <span className="text-[var(--color-mint-accent,#B9E4D0)] font-semibold">
              {activeSha ? shortSha(activeSha) : '—'}
            </span>
          </div>

          <StatusChip status={repoStatus} size="sm" />

          <Button
            size="sm"
            variant={isPinned(repository.id) ? 'secondary' : 'outline'}
            onClick={() => togglePin(repository.id)}
            className="h-7 text-xs gap-1.5 cursor-pointer"
            title={isPinned(repository.id) ? 'Unpin repository from sidebar' : 'Pin repository to sidebar'}
            aria-label={isPinned(repository.id) ? 'Unpin repository from sidebar' : 'Pin repository to sidebar'}
          >
            <MaterialIcon
              name="push_pin"
              size={13}
              fill={isPinned(repository.id) ? 1 : 0}
              color={isPinned(repository.id) ? 'var(--color-mint-accent,#B9E4D0)' : undefined}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">
              {isPinned(repository.id) ? 'Pinned' : 'Pin'}
            </span>
          </Button>

          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)] transition"
            title="Open repository on GitHub"
          >
            <MaterialIcon name="open_in_new" size={13} aria-hidden="true" />
            <span className="hidden sm:inline">GitHub</span>
          </a>

          <Button
            size="sm"
            variant="outline"
            onClick={handleReindex}
            disabled={reindexing}
            className="h-7 text-xs gap-1.5"
            title="Re-analyze repository"
          >
            <MaterialIcon name="sync" size={13} spin={reindexing} aria-hidden="true" />
            <span className="hidden sm:inline">Re-index</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
