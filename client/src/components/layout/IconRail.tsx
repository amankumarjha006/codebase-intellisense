import * as React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { MaterialIcon } from '../ui/MaterialIcon';
import { RepoMindLogo } from '../ui/RepoMindLogo';
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
          className="h-9 w-9 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none"
          title="RepoMind"
          aria-label="RepoMind Home"
        >
          <RepoMindLogo size={32} />
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
                      'group relative h-9 w-9 rounded-[var(--radius-control)] flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 select-none z-10',
                      isActive
                        ? 'text-[var(--color-accent)]'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60'
                    )}
                    aria-label={item.name}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="rail-active-pill"
                        className="absolute inset-0 rounded-[var(--radius-control)] bg-[var(--color-raised)] border border-[var(--color-border-strong)] -z-10 shadow-xs"
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="rail-active-pip"
                        className="absolute -left-2 top-2 bottom-2 w-0.5 rounded-r bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <MaterialIcon
                      name={item.icon}
                      size={19}
                      className="transition-transform duration-200 group-hover:scale-110"
                    />
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
                        'group relative h-9 w-9 rounded-[var(--radius-control)] flex items-center justify-center font-mono text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95 select-none',
                        isCurrent
                          ? 'bg-[var(--color-raised)] text-[var(--color-accent)] border border-[var(--color-accent-border)] shadow-xs'
                          : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)] hover:border-[var(--color-border-strong)]'
                      )}
                      aria-label={`${repo.owner}/${repo.name}`}
                    >
                      <span>{repo.name.slice(0, 2).toUpperCase()}</span>
                      {isCurrent && (
                        <motion.div
                          layoutId="rail-active-repo-pip"
                          className="absolute -left-2 top-2 bottom-2 w-0.5 rounded-r bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]"
                          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        />
                      )}
                      {/* Show status dot ONLY if not ready */}
                      {isNonReady && (
                        <span
                          className={cn(
                            'absolute top-1 right-1 h-1.5 w-1.5 rounded-full ring-2 ring-[var(--color-surface)] animate-pulse',
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
