import * as React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { GithubIcon } from '../ui/GithubIcon';
import { MaterialIcon } from '../ui/MaterialIcon';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { cn } from '../../lib/utils';
import { realApi, RepositoryListItemOut } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { deriveUserDisplay } from '../../lib/user';
import { usePinnedRepos } from '../../lib/pinnedRepos';
import { toast } from '../ui/sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenConnect: () => void;
  onOpenShortcuts: () => void;
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  onOpenConnect,
  onOpenShortcuts,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const userDisplay = deriveUserDisplay(user);
  const [repositories, setRepositories] = React.useState<RepositoryListItemOut[]>([]);
  const { isPinned, unpin, initIfEmpty } = usePinnedRepos();

  // Initialize with connected repositories if no preferences exist yet
  React.useEffect(() => {
    if (repositories.length > 0) {
      initIfEmpty(repositories.map((r) => r.id));
    }
  }, [repositories, initIfEmpty]);

  const pinnedRepositories = React.useMemo(() => {
    return repositories.filter((r) => isPinned(r.id));
  }, [repositories, isPinned]);

  React.useEffect(() => {
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchRepos = async () => {
      try {
        const res = await realApi.listRepositories(1, 100);
        if (!isMounted) return;
        setRepositories(res.items || []);
        const hasActive = (res.items || []).some((r) =>
          ['QUEUED', 'FETCHING', 'INDEXING', 'ANALYZING'].includes(r.latest_job_status || '')
        );
        if (hasActive) {
          timer = setTimeout(fetchRepos, 2500);
        }
      } catch {
        // ignore transient error
      }
    };

    fetchRepos();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [location.pathname]);

  const isDashboardActive = location.pathname === '/dashboard';
  const isRepositoriesActive = location.pathname === '/repositories' || location.pathname === '/repositories/';

  return (
    <aside
      className={cn(
        'relative flex flex-col h-screen border-r border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] transition-all duration-300 z-30 select-none shrink-0',
        collapsed ? 'w-[var(--width-sidebar-collapsed)]' : 'w-[var(--width-sidebar-expanded)]'
      )}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between px-3 border-b border-[var(--color-border)]">
        <NavLink
          to="/dashboard"
          className="flex items-center gap-2.5 overflow-hidden group py-1"
        >
          <div className="h-9 w-9 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border-strong)] flex items-center justify-center text-[var(--color-mint-accent,#B9E4D0)] shrink-0 group-hover:border-[var(--color-mint-accent,#B9E4D0)] transition-colors">
            <MaterialIcon name="terminal" size={22} fill={1} color="var(--color-mint-accent, #B9E4D0)" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold tracking-tight text-[var(--color-text)] truncate font-sans">
                Codebase Intellisense
              </span>
              <span className="text-[10px] text-[var(--color-muted)] font-mono truncate">
                v0.1.0-preview
              </span>
            </div>
          )}
        </NavLink>

        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-[var(--radius-control)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)] transition hidden md:flex items-center justify-center"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <MaterialIcon
            name={collapsed ? 'chevron_right' : 'chevron_left'}
            size={20}
            aria-hidden={true}
          />
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5 no-scrollbar" aria-label="Main navigation">
        {/* Primary App-Wide Links */}
        <div className="space-y-1">
          {/* Dashboard */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <NavLink
                  to="/dashboard"
                  className={cn(
                    'flex items-center justify-center p-2 rounded-[var(--radius-control)] transition-colors',
                    isDashboardActive
                      ? 'bg-[var(--color-mint-selected-bg,#253A32)] text-[var(--color-mint-accent,#B9E4D0)] border border-[rgba(185,228,208,0.22)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60'
                  )}
                  aria-label="Dashboard"
                >
                  <MaterialIcon
                    name="dashboard"
                    active={isDashboardActive}
                    size={22}
                    className="shrink-0"
                    aria-hidden={true}
                  />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right">Dashboard</TooltipContent>
            </Tooltip>
          ) : (
            <NavLink
              to="/dashboard"
              className={cn(
                'group relative flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-control)] text-xs font-medium transition-colors select-none z-10',
                isDashboardActive
                  ? 'text-[var(--color-mint-accent,#B9E4D0)] font-semibold'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60'
              )}
            >
              {isDashboardActive && (
                <motion.div
                  layoutId="sidebar-main-active"
                  className="absolute inset-0 rounded-[var(--radius-control)] bg-[var(--color-mint-selected-bg,#253A32)] border border-[rgba(185,228,208,0.22)] -z-10 shadow-xs"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
              <MaterialIcon
                name="dashboard"
                active={isDashboardActive}
                size={22}
                className={cn(
                  'shrink-0 transition-transform duration-200 group-hover:scale-110',
                  !isDashboardActive && 'group-hover:text-[var(--color-mint-hover,#D0F1E0)]'
                )}
                aria-hidden={true}
              />
              <span className={isDashboardActive ? 'font-semibold text-[var(--color-mint-accent,#B9E4D0)]' : undefined}>
                Dashboard
              </span>
            </NavLink>
          )}

          {/* Repositories */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <NavLink
                  to="/repositories"
                  className={cn(
                    'flex items-center justify-center p-2 rounded-[var(--radius-control)] transition-colors',
                    isRepositoriesActive
                      ? 'bg-[var(--color-mint-selected-bg,#253A32)] text-[var(--color-mint-accent,#B9E4D0)] border border-[rgba(185,228,208,0.22)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60'
                  )}
                  aria-label="Repositories"
                >
                  <MaterialIcon
                    name="folder_special"
                    active={isRepositoriesActive}
                    size={22}
                    className="shrink-0"
                    aria-hidden={true}
                  />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right">Repositories</TooltipContent>
            </Tooltip>
          ) : (
            <NavLink
              to="/repositories"
              className={cn(
                'group relative flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-control)] text-xs font-medium transition-colors select-none z-10',
                isRepositoriesActive
                  ? 'text-[var(--color-mint-accent,#B9E4D0)] font-semibold'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60'
              )}
            >
              {isRepositoriesActive && (
                <motion.div
                  layoutId="sidebar-main-active"
                  className="absolute inset-0 rounded-[var(--radius-control)] bg-[var(--color-mint-selected-bg,#253A32)] border border-[rgba(185,228,208,0.22)] -z-10 shadow-xs"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
              <MaterialIcon
                name="folder_special"
                active={isRepositoriesActive}
                size={22}
                className={cn(
                  'shrink-0 transition-transform duration-200 group-hover:scale-110',
                  !isRepositoriesActive && 'group-hover:text-[var(--color-mint-hover,#D0F1E0)]'
                )}
                aria-hidden={true}
              />
              <span className={isRepositoriesActive ? 'font-semibold text-[var(--color-mint-accent,#B9E4D0)]' : undefined}>
                Repositories
              </span>
            </NavLink>
          )}

          {/* Connect Repository Action */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onOpenConnect}
                  className="w-full flex items-center justify-center p-2 rounded-[var(--radius-control)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60 transition-colors"
                  aria-label="Connect repository"
                >
                  <MaterialIcon
                    name="add_circle"
                    size={22}
                    color="var(--color-mint-accent, #B9E4D0)"
                    className="shrink-0"
                    aria-hidden={true}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Connect repository</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={onOpenConnect}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-control)] text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60 transition-colors text-left group"
            >
              <MaterialIcon
                name="add_circle"
                size={22}
                color="var(--color-mint-accent, #B9E4D0)"
                className="shrink-0 group-hover:scale-105 transition-transform"
                aria-hidden={true}
              />
              <span>Connect repository</span>
            </button>
          )}
        </div>

        {/* Pinned Repositories Section */}
        {repositories.length > 0 && (
          <div role="list" aria-label="Pinned repositories">
            {!collapsed && (
              <div className="px-2.5 mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                <span className="flex items-center gap-1.5">
                  <MaterialIcon name="push_pin" size={12} fill={1} color="var(--color-mint-accent,#B9E4D0)" aria-hidden="true" />
                  <span>Pinned Repositories</span>
                </span>
                <span className="font-mono text-[9px] text-[var(--color-mint-accent,#B9E4D0)] font-semibold">{pinnedRepositories.length}</span>
              </div>
            )}

            {pinnedRepositories.length === 0 ? (
              !collapsed && (
                <div className="px-2.5 py-2.5 mx-1 text-center border border-dashed border-[var(--color-border)] rounded-[var(--radius-control)] space-y-1">
                  <p className="text-[11px] text-[var(--color-muted)]">No pinned repositories</p>
                  <NavLink
                    to="/repositories"
                    className="text-[10px] text-[var(--color-mint-accent,#B9E4D0)] hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <span>Pin from catalog</span>
                    <MaterialIcon name="arrow_forward" size={10} aria-hidden="true" />
                  </NavLink>
                </div>
              )
            ) : (
              <div className="space-y-0.5">
                {pinnedRepositories.slice(0, 10).map((repo) => {
                  const isSelected = location.pathname.startsWith(`/repositories/${repo.id}`);
                  const isReady = repo.latest_job_status === 'READY' || (repo.active_version_short_sha && !repo.latest_job_status);
                  const isIndexing = repo.latest_job_status === 'INDEXING' || repo.latest_job_status === 'FETCHING' || repo.latest_job_status === 'QUEUED' || repo.latest_job_status === 'ANALYZING';
                  const isFailed = repo.latest_job_status === 'FAILED';

                  const linkElement = (
                    <NavLink
                      key={repo.id}
                      to={`/repositories/${repo.id}`}
                      className={cn(
                        'group relative flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[var(--radius-control)] text-xs font-medium transition-colors select-none z-10',
                        isSelected
                          ? 'text-[var(--color-mint-accent,#B9E4D0)] font-semibold'
                          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60',
                        collapsed && 'justify-center p-2'
                      )}
                    >
                      {isSelected && !collapsed && (
                        <motion.div
                          layoutId="sidebar-pinned-active"
                          className="absolute inset-0 rounded-[var(--radius-control)] bg-[var(--color-mint-selected-bg,#253A32)] border border-[rgba(185,228,208,0.22)] -z-10 shadow-xs"
                          transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                        />
                      )}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MaterialIcon
                          name="folder"
                          active={isSelected}
                          size={20}
                          className={cn(
                            'shrink-0 transition-colors',
                            !isSelected && 'group-hover:text-[var(--color-mint-hover,#D0F1E0)]'
                          )}
                          aria-hidden="true"
                        />
                        {!collapsed && (
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className={cn('truncate', isSelected && 'font-semibold text-[var(--color-mint-accent,#B9E4D0)]')}>
                              {repo.name}
                            </span>
                            {isIndexing && (
                              <div className="w-20 h-1 mt-1 rounded-full bg-[var(--color-surface)] overflow-hidden border border-[var(--color-border)]/40">
                                <div
                                  className="h-full bg-[var(--color-warning)] rounded-full transition-all duration-500 animate-pulse"
                                  style={{
                                    width:
                                      repo.latest_job_status === 'FETCHING'
                                        ? '35%'
                                        : repo.latest_job_status === 'INDEXING'
                                        ? '70%'
                                        : repo.latest_job_status === 'ANALYZING'
                                        ? '90%'
                                        : '15%',
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {!collapsed && (
                        <div className="shrink-0 flex items-center gap-1">
                          {/* Unpin button appears on hover */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              unpin(repo.id);
                              toast(`Unpinned ${repo.owner}/${repo.name} from sidebar`);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--color-muted)] hover:text-[var(--color-error)] transition-all cursor-pointer"
                            title={`Unpin ${repo.name} from sidebar`}
                            aria-label={`Unpin ${repo.name} from sidebar`}
                          >
                            <MaterialIcon name="push_pin" size={13} fill={1} aria-hidden="true" />
                          </button>

                          {/* Status Indicator (hidden on hover when unpin button appears) */}
                          <div className="group-hover:hidden">
                            {isReady && (
                              <MaterialIcon
                                name="check_circle"
                                size={15}
                                fill={1}
                                color="var(--color-mint-accent, #B9E4D0)"
                                aria-label="Ready"
                              />
                            )}
                            {isIndexing && (
                              <MaterialIcon
                                name="sync"
                                size={15}
                                spin
                                color="var(--color-warning)"
                                aria-label="Indexing"
                              />
                            )}
                            {isFailed && (
                              <MaterialIcon
                                name="error"
                                size={15}
                                fill={1}
                                color="var(--color-error)"
                                aria-label="Failed"
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </NavLink>
                  );

                  if (collapsed) {
                    return (
                      <Tooltip key={repo.id}>
                        <TooltipTrigger asChild>{linkElement}</TooltipTrigger>
                        <TooltipContent side="right">
                          <div className="flex items-center gap-2">
                            <span>{repo.owner}/{repo.name}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                unpin(repo.id);
                              }}
                              className="text-[var(--color-muted)] hover:text-[var(--color-error)] cursor-pointer"
                              title="Unpin from sidebar"
                            >
                              <MaterialIcon name="push_pin" size={12} fill={1} />
                            </button>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return linkElement;
                })}
              </div>
            )}
          </div>
        )}

        {/* Resources & Docs */}
        <div>
          {!collapsed && (
            <div className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Resources & Help
            </div>
          )}
          <div className="space-y-0.5">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center p-2 rounded-[var(--radius-control)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60 transition-colors"
                    aria-label="Documentation"
                  >
                    <MaterialIcon name="menu_book" size={20} className="shrink-0" />
                  </a>
                </TooltipTrigger>
                <TooltipContent side="right">Documentation</TooltipContent>
              </Tooltip>
            ) : (
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[var(--radius-control)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MaterialIcon name="menu_book" size={20} className="shrink-0 text-[var(--color-icon-inactive)]" />
                  <span>Documentation</span>
                </div>
                <MaterialIcon name="open_in_new" size={16} className="text-[var(--color-muted)]" />
              </a>
            )}

            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onOpenShortcuts}
                    className="w-full flex items-center justify-center p-2 rounded-[var(--radius-control)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60 transition-colors"
                    aria-label="Keyboard Shortcuts"
                  >
                    <MaterialIcon name="keyboard" size={20} className="shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Keyboard Shortcuts (?)</TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={onOpenShortcuts}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[var(--radius-control)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <MaterialIcon name="keyboard" size={20} className="shrink-0 text-[var(--color-icon-inactive)]" />
                  <span>Shortcuts</span>
                </div>
                <span className="font-mono text-[10px] text-[var(--color-muted)]">?</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* User Menu Footer */}
      <div className="p-2 border-t border-[var(--color-border)]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'w-full flex items-center gap-2.5 p-1.5 rounded-[var(--radius-control)] text-left hover:bg-[var(--color-raised)] transition outline-none group cursor-pointer',
                collapsed ? 'justify-center' : 'justify-between'
              )}
              aria-label="User account menu"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 rounded-full bg-[var(--color-raised)] border border-[var(--color-border-strong)] flex items-center justify-center text-xs font-semibold text-[var(--color-text)] shrink-0">
                  {userDisplay.initials}
                </div>
                {!collapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-[var(--color-text)] truncate">
                      {userDisplay.name}
                    </span>
                    <span className="text-[10px] text-[var(--color-muted)] truncate">
                      @{userDisplay.username}
                    </span>
                  </div>
                )}
              </div>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent side="right" align="end" className="w-56 mb-2">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-semibold text-xs text-[var(--color-text)]">
                  {userDisplay.name}
                </span>
                <span className="text-[11px] font-normal text-[var(--color-muted)]">
                  {userDisplay.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/dashboard')}>
              <MaterialIcon name="dashboard" size={20} className="mr-2" />
              <span>Dashboard</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenShortcuts}>
              <MaterialIcon name="keyboard" size={20} className="mr-2" />
              <span>Keyboard Shortcuts</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(`https://github.com/${userDisplay.username}`, '_blank')}>
              <GithubIcon size={20} className="mr-2" />
              <span>GitHub Profile</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              onClick={() => logout()}
            >
              <MaterialIcon name="logout" size={20} className="mr-2" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
