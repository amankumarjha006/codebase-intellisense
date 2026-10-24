import { Link, useLocation } from 'react-router-dom';
import { Repository } from '../../lib/types';
import { Button } from '../ui/button';
import { MaterialIcon } from '../ui/MaterialIcon';
import { shortSha, cn } from '../../lib/utils';
import { api } from '../../lib/api';
import * as React from 'react';

interface RepositoryHeaderProps {
  repository: Repository;
  onRefresh?: () => void;
  hideRepoInfo?: boolean;
}

export function RepositoryHeader({
  repository,
  onRefresh,
}: RepositoryHeaderProps) {
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
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur-md sticky top-0 z-30 select-none">
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

      {/* Repository Horizontal Navigation Bar */}
      <nav
        aria-label="Repository sections"
        className="px-4 sm:px-6 max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto no-scrollbar py-1.5"
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
              size={18}
              className={cn(
                'shrink-0 transition-colors',
                !item.isActive && 'group-hover:text-[var(--color-mint-hover,#D0F1E0)]'
              )}
              aria-hidden="true"
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
