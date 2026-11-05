import * as React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../ui/MaterialIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';
import { usePinnedRepos } from '../../lib/pinnedRepos';
import { useIndexingStatus } from '../../lib/useIndexingStatus';

interface IconRailProps {
  onOpenCommand: () => void;
}

export function IconRail({ onOpenCommand }: IconRailProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isPinned } = usePinnedRepos();
  const { repositories } = useIndexingStatus();

  const pinnedRepos = React.useMemo(() => {
    return repositories.filter((r) => isPinned(r.id));
  }, [repositories, isPinned]);

  const navItems = [
    { name: 'Home', path: '/dashboard', icon: 'home' },
    { name: 'Repositories', path: '/repositories', icon: 'folder' },
  ];

  return (
    <aside
      className="hidden md:flex flex-col w-[56px] h-screen border-r border-[var(--color-border)] bg-[var(--color-surface)] shrink-0 items-center py-3 select-none z-30 justify-between"
      aria-label="Primary Navigation Rail"
    >
      {/* Top Brand & Primary Nav */}
      <div className="flex flex-col items-center gap-4 w-full">
        {/* Brand Icon */}
        <NavLink
          to="/dashboard"
          className="h-9 w-9 rounded-[var(--radius-control)] bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)] hover:border-[var(--color-border-strong)] transition-colors focus-visible:outline-none"
          title="Codebase Intellisense"
          aria-label="Codebase Intellisense Home"
        >
          <MaterialIcon name="terminal" size={20} color="var(--color-accent)" />
        </NavLink>

        {/* Core Navigation Items */}
        <nav className="flex flex-col items-center gap-1.5 w-full px-2" aria-label="Main Destinations">
          {navItems.map((item) => {
            const isActive =
              item.path === '/dashboard'
                ? location.pathname === '/dashboard'
                : location.pathname.startsWith(item.path);

            return (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.path}
                    className={cn(
                      'h-9 w-9 rounded-[var(--radius-control)] flex items-center justify-center transition-colors',
                      isActive
                        ? 'bg-[var(--color-raised)] text-[var(--color-text)] border border-[var(--color-border-strong)]'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60'
                    )}
                    aria-label={item.name}
                  >
                    <MaterialIcon name={item.icon} size={19} />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.name}
                </TooltipContent>
              </Tooltip>
            );
          })}

          {/* Quick Search ⌘K Trigger */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onOpenCommand}
                className="h-9 w-9 rounded-[var(--radius-control)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60 transition-colors"
                aria-label="Quick Find (Command K)"
              >
                <MaterialIcon name="search" size={19} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Quick Find (⌘K)
            </TooltipContent>
          </Tooltip>
        </nav>

        {/* Pinned Repositories Rail */}
        {pinnedRepos.length > 0 && (
          <div className="flex flex-col items-center gap-1.5 w-full pt-3 border-t border-[var(--color-border)] px-2">
            <span className="text-[10px] text-[var(--color-text-tertiary)] uppercase font-mono tracking-wider mb-1">
              Pinned
            </span>
            {pinnedRepos.map((repo) => {
              const isCurrent = location.pathname.startsWith(`/repositories/${repo.id}`);
              const isNonReady =
                repo.latest_job_status &&
                repo.latest_job_status !== 'READY' &&
                repo.latest_job_status !== 'SUCCESS';
              const dotColor = repo.latest_job_status === 'FAILED' ? 'bg-[#F28B82]' : 'bg-[#FDD663]';

              return (
                <Tooltip key={repo.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => navigate(`/repositories/${repo.id}`)}
                      className={cn(
                        'relative h-9 w-9 rounded-[var(--radius-control)] flex items-center justify-center font-mono text-xs font-medium transition-colors',
                        isCurrent
                          ? 'bg-[var(--color-raised)] text-[var(--color-accent)] border border-[var(--color-accent-border)]'
                          : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]'
                      )}
                      aria-label={`${repo.owner}/${repo.name}`}
                    >
                      <span>{repo.name.slice(0, 2).toUpperCase()}</span>
                      {/* Show status dot ONLY if not ready */}
                      {isNonReady && (
                        <span
                          className={cn(
                            'absolute top-1 right-1 h-1.5 w-1.5 rounded-full ring-2 ring-[var(--color-surface)]',
                            dotColor
                          )}
                          aria-label={`Status: ${repo.latest_job_status}`}
                        />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {repo.owner}/{repo.name}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Profile / Help */}
      <div className="flex flex-col items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="h-8 w-8 rounded-[var(--radius-control)] flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)] transition-colors"
              aria-label="Documentation"
            >
              <MaterialIcon name="help" size={17} />
            </a>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            Documentation & Support
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
