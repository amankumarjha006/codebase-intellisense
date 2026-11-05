import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { MaterialIcon } from '../ui/MaterialIcon';
import { StatusDot } from '../ui/StatusDot';
import { Button } from '../ui/button';
import { shortSha } from '../../lib/utils';
import { isInputFocused } from '../../lib/keyboard';
import { usePinnedRepos } from '../../lib/pinnedRepos';
import { getRepositoryStatusCategory } from '../../lib/repositoryTableUtils';
import { toast } from '../ui/sonner';

export interface HeaderRepository {
  id: string;
  owner: string;
  name: string;
  is_private?: boolean;
  active_version?: {
    branch?: string;
    commit_sha?: string;
    status?: string;
    indexed_at?: string | null;
  } | null;
  indexed_commit?: string | null;
  active_version_short_sha?: string | null;
  latest_job_status?: string | null;
  default_branch?: string | null;
}

interface RepositoryHeaderProps {
  repository: HeaderRepository;
  onReindex?: () => Promise<void>;
  onRefresh?: () => void;
}

export function RepositoryHeader({
  repository,
  onReindex,
  onRefresh,
}: RepositoryHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isPinned, togglePin } = usePinnedRepos();
  const [isReindexing, setIsReindexing] = React.useState(false);

  const basePath = `/repositories/${repository.id}`;
  const currentPath = location.pathname;

  // Derive commit and branch info safely
  const activeVersion = repository.active_version;
  const commitSha =
    activeVersion?.commit_sha ||
    repository.active_version_short_sha ||
    repository.indexed_commit ||
    '';
  const branchName = activeVersion?.branch || repository.default_branch || 'main';

  // Keyboard navigation shortcuts 1-5 guarded by isInputFocused
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused() || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      switch (e.key) {
        case '1':
          e.preventDefault();
          navigate(basePath);
          break;
        case '2':
          e.preventDefault();
          navigate(`${basePath}/architecture`);
          break;
        case '3':
          e.preventDefault();
          navigate(`${basePath}/chat`);
          break;
        case '4':
          e.preventDefault();
          navigate(`${basePath}/search`);
          break;
        case '5':
          e.preventDefault();
          navigate(`${basePath}/files`);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [basePath, navigate]);

  const handleCopySha = () => {
    if (!commitSha) return;
    navigator.clipboard.writeText(commitSha);
    toast.success(`Copied commit SHA: ${shortSha(commitSha)}`);
  };

  const handleReindexClick = async () => {
    setIsReindexing(true);
    try {
      if (onReindex) {
        await onReindex();
      }
      onRefresh?.();
      toast.success('Indexing job started');
    } catch (err) {
      toast.error('Failed to trigger indexing', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsReindexing(false);
    }
  };

  const statusCategory = getRepositoryStatusCategory({
    id: repository.id,
    owner: repository.owner,
    name: repository.name,
    is_private: Boolean(repository.is_private),
    created_at: '',
    latest_job_status: repository.latest_job_status || activeVersion?.status || null,
    latest_job_failure_code: null,
    active_version_short_sha: commitSha || null,
    last_indexed_at: activeVersion?.indexed_at || null,
  });

  const pinned = isPinned(repository.id);

  const navTabs = [
    {
      id: 'overview',
      name: 'Overview',
      shortcut: '1',
      path: basePath,
      icon: 'description',
      isActive: currentPath === basePath || currentPath === `${basePath}/`,
    },
    {
      id: 'architecture',
      name: 'Architecture',
      shortcut: '2',
      path: `${basePath}/architecture`,
      icon: 'account_tree',
      isActive: currentPath.startsWith(`${basePath}/architecture`),
    },
    {
      id: 'chat',
      name: 'Chat',
      shortcut: '3',
      path: `${basePath}/chat`,
      icon: 'chat',
      isActive: currentPath.startsWith(`${basePath}/chat`),
    },
    {
      id: 'search',
      name: 'Search',
      shortcut: '4',
      path: `${basePath}/search`,
      icon: 'search',
      isActive: currentPath.startsWith(`${basePath}/search`),
    },
    {
      id: 'files',
      name: 'Files',
      shortcut: '5',
      path: `${basePath}/files`,
      icon: 'folder',
      isActive: currentPath.startsWith(`${basePath}/files`),
    },
  ];

  return (
    <div className="border-b border-white/10 bg-surface-base/90 backdrop-blur-xs sticky top-0 z-30">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-4">
        {/* Top bar: Breadcrumb & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              to="/repositories"
              className="text-xs text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
            >
              Repositories
            </Link>
            <span className="text-xs text-text-tertiary">/</span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-text-secondary truncate">{repository.owner}</span>
              <span className="text-text-tertiary">/</span>
              <h1 className="text-sm font-semibold text-text-primary truncate">
                {repository.name}
              </h1>
              {repository.is_private && (
                <MaterialIcon name="lock" size={13} className="text-text-tertiary shrink-0" />
              )}
            </div>

            {/* Commit and branch badge */}
            {commitSha && (
              <button
                type="button"
                onClick={handleCopySha}
                className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-surface-raised border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                title="Click to copy full commit SHA"
              >
                <span>{branchName}@{shortSha(commitSha)}</span>
                <MaterialIcon name="content_copy" size={12} className="text-text-tertiary" />
              </button>
            )}

            <StatusDot
              status={
                statusCategory === 'INDEXING'
                  ? 'indexing'
                  : statusCategory === 'FAILED'
                  ? 'failed'
                  : 'ready'
              }
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => togglePin(repository.id)}
              className="text-text-tertiary hover:text-accent p-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              aria-label={pinned ? 'Unpin repository' : 'Pin repository'}
            >
              <MaterialIcon
                name="keep"
                fill={pinned ? 1 : 0}
                size={16}
                className={pinned ? 'text-accent' : 'text-text-tertiary'}
              />
            </button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                window.open(
                  `https://github.com/${repository.owner}/${repository.name}`,
                  '_blank',
                  'noopener,noreferrer'
                )
              }
              className="h-7 px-2 text-xs text-text-secondary hover:text-text-primary gap-1 border border-white/10"
            >
              <MaterialIcon name="open_in_new" size={14} />
              GitHub
            </Button>

            {(onReindex || onRefresh) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReindexClick}
                disabled={isReindexing}
                className="h-7 px-2 text-xs text-text-secondary hover:text-text-primary gap-1 border border-white/10"
              >
                <MaterialIcon name="refresh" size={14} spin={isReindexing} />
                Re-index
              </Button>
            )}
          </div>
        </div>

        {/* 5 Tab Links with Motion layout indicator */}
        <nav
          className="flex items-center gap-1 overflow-x-auto no-scrollbar -mb-px"
          aria-label="Repository navigation"
        >
          {navTabs.map((tab) => {
            return (
              <Link
                key={tab.id}
                to={tab.path}
                className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors select-none rounded-t focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                  tab.isActive
                    ? 'text-accent font-semibold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <MaterialIcon name={tab.icon} size={15} />
                <span>{tab.name}</span>
                <span className="hidden sm:inline text-[10px] text-text-tertiary font-mono">
                  {tab.shortcut}
                </span>

                {tab.isActive && (
                  <motion.div
                    layoutId="repo-header-active-tab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
