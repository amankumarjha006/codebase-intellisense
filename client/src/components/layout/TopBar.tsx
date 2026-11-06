import * as React from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { MaterialIcon } from '../ui/MaterialIcon';
import { Button } from '../ui/button';
import { ThemeToggle } from '../ui/ThemeToggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useAuth } from '../../lib/AuthContext';
import { useIndexingStatus } from '../../lib/useIndexingStatus';
import { usePinnedRepos } from '../../lib/pinnedRepos';
import { cn } from '../../lib/utils';
import { deriveUserDisplay } from '../../lib/user';

interface TopBarProps {
  onOpenCommand: () => void;
  onOpenConnect?: () => void;
}

export function TopBar({ onOpenCommand, onOpenConnect: _onOpenConnect }: TopBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { id: currentRepoId } = useParams<{ id?: string }>();
  const { user, logout } = useAuth();
  const userDisplay = deriveUserDisplay(user);

  const { repositories, activeJobRepo, isIndexing } = useIndexingStatus();
  const { isPinned } = usePinnedRepos();

  // Find current repository details if inside a repo view
  const currentRepo = React.useMemo(() => {
    if (!currentRepoId) return null;
    return repositories.find((r) => r.id === currentRepoId) || null;
  }, [repositories, currentRepoId]);

  // Sort repos for the repo switcher combobox (pinned first, then alphabetical)
  const sortedRepos = React.useMemo(() => {
    return [...repositories].sort((a, b) => {
      const aPinned = isPinned(a.id) ? 1 : 0;
      const bPinned = isPinned(b.id) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return a.name.localeCompare(b.name);
    });
  }, [repositories, isPinned]);

  // Derive subpath inside repo
  const repoSubpath = React.useMemo(() => {
    if (!currentRepoId) return '';
    const parts = location.pathname.split(`/repositories/${currentRepoId}`);
    const sub = parts[1] ? parts[1].replace(/^\//, '') : '';
    if (!sub) return 'Overview';
    return sub.charAt(0).toUpperCase() + sub.slice(1);
  }, [currentRepoId, location.pathname]);

  const isInsideRepo = Boolean(currentRepoId);

  return (
    <header className="h-[var(--height-topbar)] px-3 sm:px-4 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur z-20 select-none shrink-0">
      {/* Left: Dynamic Breadcrumb & Repo Switcher */}
      <div className="flex items-center gap-2 min-w-0">
        {isInsideRepo && currentRepo ? (
          <div className="flex items-center gap-1.5 text-xs">
            <Link
              to="/repositories"
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors hidden sm:inline"
            >
              Repositories
            </Link>
            <span className="text-[var(--color-border-strong)] hidden sm:inline">/</span>

            {/* Repo Switcher Combobox */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-control)] bg-[var(--color-raised)]/70 hover:bg-[var(--color-raised)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[var(--color-text)] font-medium transition-colors focus-visible:outline-none"
                  aria-label="Switch repository"
                >
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">
                    {currentRepo.owner}/{currentRepo.name}
                  </span>
                  <MaterialIcon name="expand_more" size={16} className="text-[var(--color-text-tertiary)]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
                <DropdownMenuLabel className="text-[11px] text-[var(--color-text-tertiary)] font-normal">
                  Switch Repository
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {sortedRepos.map((repo) => {
                  const isCurrent = repo.id === currentRepoId;
                  const pinned = isPinned(repo.id);
                  const isNonReady = repo.latest_job_status && repo.latest_job_status !== 'READY' && repo.latest_job_status !== 'SUCCESS';

                  return (
                    <DropdownMenuItem
                      key={repo.id}
                      onClick={() => {
                        const targetSub = location.pathname.split(`/repositories/${currentRepoId}`)[1] || '';
                        navigate(`/repositories/${repo.id}${targetSub}`);
                      }}
                      className={cn(
                        'flex items-center justify-between cursor-pointer py-1.5',
                        isCurrent && 'bg-[var(--color-raised)] font-medium text-[var(--color-accent)]'
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {pinned && (
                          <MaterialIcon name="keep-fill" size={12} className="text-[var(--color-accent)] shrink-0" />
                        )}
                        <span className="truncate">{repo.owner}/{repo.name}</span>
                      </div>
                      {isNonReady && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[#FDD663] shrink-0" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Subpath label */}
            <span className="text-[var(--color-border-strong)]">/</span>
            <span className="text-[var(--color-text-secondary)] font-medium truncate">{repoSubpath}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-text)]">
            <span>{location.pathname === '/repositories' ? 'Repositories' : 'Home'}</span>
          </div>
        )}
      </div>

      {/* Center: Global Indexing Progress Chip (rendered ONLY when active) */}
      <div className="flex items-center justify-center">
        {isIndexing && activeJobRepo && (
          <button
            type="button"
            onClick={() => navigate(`/repositories/${activeJobRepo.id}`)}
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs bg-[var(--color-raised)] border border-[rgba(253,214,99,0.3)] hover:border-[rgba(253,214,99,0.6)] text-[var(--color-text)] shadow-xs transition-colors cursor-pointer"
            title={`Indexing in progress for ${activeJobRepo.name}`}
            aria-label={`Indexing job active: ${activeJobRepo.name}`}
          >
            <span className="h-2 w-2 rounded-full bg-[#FDD663] animate-pulse" aria-hidden="true" />
            <span className="font-mono text-[11px] truncate max-w-[120px] sm:max-w-[200px]">
              {activeJobRepo.name}: {activeJobRepo.latest_job_status?.toLowerCase()}
            </span>
          </button>
        )}
      </div>

      {/* Right: ⌘K Trigger, Contextual CTA, User Menu */}
      <div className="flex items-center gap-2">
        {/* ⌘K Command Palette Button */}
        <button
          type="button"
          onClick={onOpenCommand}
          className="hidden sm:inline-flex items-center gap-2 h-8 px-2.5 rounded-[var(--radius-control)] bg-[var(--color-raised)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors focus-visible:outline-none"
          aria-label="Quick find (Command K)"
        >
          <MaterialIcon name="search" size={15} />
          <span>Quick find...</span>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-tertiary)]">
            ⌘K
          </kbd>
        </button>



        {isInsideRepo && currentRepo && !location.pathname.endsWith('/chat') && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(`/repositories/${currentRepo.id}/chat`)}
            className="h-8 px-3 text-xs font-medium gap-1.5 bg-[var(--color-text)] text-[var(--color-page)] hover:opacity-90 transition-colors cursor-pointer"
          >
            <MaterialIcon name="chat" size={16} />
            <span>Ask in chat</span>
          </Button>
        )}

        {/* Theme Toggle (Dark / Light) */}
        <ThemeToggle />

        {/* User Menu Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-8 w-8 rounded-full bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center font-mono text-xs font-medium text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors focus-visible:outline-none ml-1 cursor-pointer"
              aria-label="User Account Menu"
            >
              <span>{userDisplay.initials}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-medium leading-none text-[var(--color-text)]">{userDisplay.name}</p>
                <p className="text-[11px] leading-none text-[var(--color-text-secondary)] font-mono">{userDisplay.email}</p>
                {user?.github?.username && (
                  <p className="text-[11px] leading-none text-[var(--color-accent)] font-mono pt-0.5">@{user.github.username}</p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/repositories')} className="cursor-pointer">
              <MaterialIcon name="folder" size={16} className="mr-2" />
              <span>Repositories</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenCommand} className="cursor-pointer">
              <MaterialIcon name="search" size={16} className="mr-2" />
              <span>Command Palette (⌘K)</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="cursor-pointer text-[var(--color-error)]">
              <MaterialIcon name="logout" size={16} className="mr-2 text-[var(--color-error)]" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
