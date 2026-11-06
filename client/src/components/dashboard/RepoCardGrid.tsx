import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../ui/MaterialIcon';
import { StatusDot } from '../ui/StatusDot';
import { formatRelativeTime, shortSha } from '../../lib/utils';
import { getRepositoryStatusCategory } from '../../lib/repositoryTableUtils';
import type { RepositoryListItemOut } from '../../lib/api';

interface RepoCardGridProps {
  repositories: RepositoryListItemOut[];
}

export function RepoCardGrid({ repositories }: RepoCardGridProps) {
  const navigate = useNavigate();

  if (!repositories || repositories.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          Connected Repositories
        </h3>
        <span className="text-xs text-text-tertiary tabular-nums font-mono">
          {repositories.length}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {repositories.map((repo) => {
          const category = getRepositoryStatusCategory(repo);

          return (
            <div
              key={repo.id}
              onClick={() => navigate(`/repositories/${repo.id}`)}
              className="group p-4 rounded-lg border border-white/10 bg-surface-raised hover:border-accent/40 hover:bg-surface-overlay hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 active:scale-[0.99] cursor-pointer space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs text-text-secondary truncate">{repo.owner}</span>
                    <span className="text-text-tertiary">/</span>
                    <span className="text-xs font-semibold text-text-primary truncate group-hover:text-accent transition-colors">
                      {repo.name}
                    </span>
                    {repo.is_private && (
                      <MaterialIcon
                        name="lock"
                        size={12}
                        className="text-text-tertiary shrink-0"
                      />
                    )}
                  </div>
                  <StatusDot
                    status={
                      category === 'INDEXING'
                        ? 'indexing'
                        : category === 'FAILED'
                        ? 'failed'
                        : 'ready'
                    }
                  />
                </div>

                <p className="text-xs text-text-secondary line-clamp-1">
                  {repo.active_version_short_sha
                    ? `Indexed at ${shortSha(repo.active_version_short_sha)}`
                    : 'Awaiting indexing'}
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] text-text-tertiary pt-2 border-t border-white/5">
                <span>
                  {repo.last_indexed_at
                    ? formatRelativeTime(repo.last_indexed_at)
                    : 'Never synced'}
                </span>
                <span className="group-hover:text-accent flex items-center gap-0.5 transition-colors">
                  Open
                  <MaterialIcon name="arrow_forward" size={12} />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

