import * as React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  GitBranch,
  BookOpen,
  Terminal,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Keyboard,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { GithubIcon } from '../ui/GithubIcon';
import { cn } from '../../lib/utils';
import { realApi, RepositoryListItemOut } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { deriveUserDisplay } from '../../lib/user';
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

  React.useEffect(() => {
    let isMounted = true;
    realApi.listRepositories(1, 100).then((res) => {
      if (isMounted) setRepositories(res.items || []);
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [location.pathname]);

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
          <div className="h-8 w-8 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border-strong)] flex items-center justify-center text-[var(--color-accent)] shrink-0 group-hover:border-[var(--color-accent)] transition-colors">
            <Terminal size={17} />
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
          className="p-1 rounded-[var(--radius-control)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)] transition hidden md:flex items-center justify-center"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={15} aria-hidden="true" /> : <ChevronLeft size={15} aria-hidden="true" />}
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5 no-scrollbar" aria-label="Main navigation">
        {/* Primary Links */}
        <div className="space-y-0.5">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-[var(--radius-control)] text-xs font-medium transition-colors',
                isActive
                  ? 'bg-[var(--color-raised)] text-[var(--color-text)] border border-[var(--color-border-strong)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60'
              )
            }
            title={collapsed ? 'Dashboard' : undefined}
          >
            <LayoutDashboard size={16} className="shrink-0" aria-hidden="true" />
            {!collapsed ? <span>Dashboard</span> : <span className="sr-only">Dashboard</span>}
          </NavLink>

          <button
            onClick={onOpenConnect}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-[var(--radius-control)] text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60 transition-colors text-left"
            title={collapsed ? 'Connect repository' : undefined}
          >
            <Plus size={16} className="shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
            {!collapsed ? <span>Connect repository</span> : <span className="sr-only">Connect repository</span>}
          </button>
        </div>

        {/* Repositories */}
        {repositories.length > 0 && (
          <div role="list" aria-label="Connected repositories">
            {!collapsed && (
              <div className="px-2.5 mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                <span>Repositories</span>
                <span className="font-mono text-[9px]">{repositories.length}</span>
              </div>
            )}

            <div className="space-y-0.5">
              {repositories.map((repo) => {
                const isSelected = location.pathname.startsWith(`/repositories/${repo.id}`);
                const isReady = repo.latest_job_status === 'READY' || repo.latest_job_status === 'SUCCESS' || repo.latest_job_status === 'INDEXED' || (repo.active_version_short_sha && !repo.latest_job_status);
                const isIndexing = repo.latest_job_status === 'INDEXING' || repo.latest_job_status === 'FETCHING' || repo.latest_job_status === 'QUEUED';
                const isFailed = repo.latest_job_status === 'FAILED';

                return (
                  <NavLink
                    key={repo.id}
                    to={`/repositories/${repo.id}`}
                    className={cn(
                      'group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[var(--radius-control)] text-xs font-medium transition-colors',
                      isSelected
                        ? 'bg-[var(--color-raised)] text-[var(--color-text)] border border-[var(--color-border-strong)]'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60'
                    )}
                    title={collapsed ? `${repo.owner}/${repo.name}` : undefined}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GitBranch size={14} className="shrink-0 text-[var(--color-muted)] group-hover:text-[var(--color-text)]" aria-hidden="true" />
                      {!collapsed ? <span className="truncate">{repo.name}</span> : <span className="sr-only">{repo.owner}/{repo.name}</span>}
                    </div>

                    {!collapsed && (
                      <div className="shrink-0">
                        {isReady && (
                          <CheckCircle2 size={12} className="text-[var(--color-accent)]" />
                        )}
                        {isIndexing && (
                          <Loader2 size={12} className="animate-spin text-[var(--color-warning)]" />
                        )}
                        {isFailed && (
                          <AlertCircle size={12} className="text-[var(--color-error)]" />
                        )}
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        )}

        {/* Resources & Docs */}
        <div>
          {!collapsed && (
            <div className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Resources
            </div>
          )}
          <div className="space-y-0.5">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[var(--radius-control)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60 transition-colors"
              title={collapsed ? 'GitHub Docs' : undefined}
            >
              <div className="flex items-center gap-2">
                <BookOpen size={15} className="shrink-0" />
                {!collapsed && <span>Documentation</span>}
              </div>
              {!collapsed && <ExternalLink size={11} className="text-[var(--color-muted)]" />}
            </a>

            <button
              onClick={onOpenShortcuts}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[var(--radius-control)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60 transition-colors text-left"
              title={collapsed ? 'Keyboard shortcuts' : undefined}
            >
              <div className="flex items-center gap-2">
                <Keyboard size={15} className="shrink-0" />
                {!collapsed && <span>Shortcuts</span>}
              </div>
              {!collapsed && <span className="font-mono text-[10px] text-[var(--color-muted)]">?</span>}
            </button>
          </div>
        </div>
      </nav>

      {/* User Menu Footer */}
      <div className="p-2 border-t border-[var(--color-border)]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'w-full flex items-center gap-2.5 p-1.5 rounded-[var(--radius-control)] text-left hover:bg-[var(--color-raised)] transition outline-none group',
                collapsed ? 'justify-center' : 'justify-between'
              )}
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
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenShortcuts}>
              <Keyboard className="mr-2 h-4 w-4" />
              <span>Keyboard Shortcuts</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(`https://github.com/${userDisplay.username}`, '_blank')}>
              <GithubIcon className="mr-2 h-4 w-4" />
              <span>GitHub Profile</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              onClick={() => logout()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
