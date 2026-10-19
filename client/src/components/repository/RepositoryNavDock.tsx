import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FileText,
  MessageSquare,
  Layers,
  Search,
  FolderTree,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface RepositoryNavDockProps {
  repoId: string;
  orientation?: 'vertical' | 'horizontal' | 'responsive';
  className?: string;
}

export function RepositoryNavDock({
  repoId,
  orientation = 'responsive',
  className,
}: RepositoryNavDockProps) {
  const location = useLocation();
  const currentPath = location.pathname;
  const basePath = `/repositories/${repoId}`;

  const navItems = [
    {
      name: 'Overview',
      path: basePath,
      icon: FileText,
      isActive: currentPath === basePath || currentPath === `${basePath}/`,
    },
    {
      name: 'Chat',
      path: `${basePath}/chat`,
      icon: MessageSquare,
      isActive: currentPath.startsWith(`${basePath}/chat`),
    },
    {
      name: 'Architecture',
      path: `${basePath}/architecture`,
      icon: Layers,
      isActive: currentPath.startsWith(`${basePath}/architecture`),
    },
    {
      name: 'Search',
      path: `${basePath}/search`,
      icon: Search,
      isActive: currentPath.startsWith(`${basePath}/search`),
    },
    {
      name: 'Files',
      path: `${basePath}/files`,
      icon: FolderTree,
      isActive: currentPath.startsWith(`${basePath}/files`),
    },
  ];

  // If orientation is explicitly horizontal
  if (orientation === 'horizontal') {
    return (
      <nav
        aria-label="Repository navigation"
        className={cn(
          'flex items-center gap-1 p-1 rounded-xl bg-[var(--color-surface)]/90 backdrop-blur-md border border-[var(--color-border)] overflow-x-auto no-scrollbar',
          className
        )}
      >
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            aria-current={item.isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors select-none',
              item.isActive
                ? 'bg-[var(--color-accent-tint)] text-[var(--color-accent)] font-semibold border border-[var(--color-accent-border)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/70'
            )}
          >
            <item.icon
              size={13}
              className={cn(
                'shrink-0',
                item.isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]'
              )}
              aria-hidden="true"
            />
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>
    );
  }

  // If orientation is explicitly vertical
  if (orientation === 'vertical') {
    return (
      <nav
        aria-label="Repository navigation dock"
        className={cn(
          'flex flex-col gap-1 p-1.5 w-36 rounded-2xl bg-[var(--color-surface)]/95 backdrop-blur-md border border-[var(--color-border)] shadow-xl shrink-0',
          className
        )}
      >
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            aria-current={item.isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all font-medium select-none group',
              item.isActive
                ? 'bg-[var(--color-accent-tint)] text-[var(--color-accent)] font-semibold border border-[var(--color-accent-border)] shadow-xs'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/70'
            )}
          >
            <item.icon
              size={14}
              className={cn(
                'shrink-0 transition-transform group-hover:scale-105',
                item.isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)] group-hover:text-[var(--color-text)]'
              )}
              aria-hidden="true"
            />
            <span className="truncate">{item.name}</span>
          </Link>
        ))}
      </nav>
    );
  }

  // Default responsive behavior:
  // Compact horizontal tabs on small screens (< lg), sleek vertical dock on desktop (lg+)
  return (
    <>
      {/* Mobile & Tablet: Compact Horizontal Strip */}
      <nav
        aria-label="Repository navigation"
        className={cn(
          'lg:hidden flex items-center gap-1 p-1 rounded-xl bg-[var(--color-surface)]/90 backdrop-blur-md border border-[var(--color-border)] overflow-x-auto no-scrollbar',
          className
        )}
      >
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            aria-current={item.isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors select-none',
              item.isActive
                ? 'bg-[var(--color-accent-tint)] text-[var(--color-accent)] font-semibold border border-[var(--color-accent-border)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/70'
            )}
          >
            <item.icon
              size={13}
              className={cn(
                'shrink-0',
                item.isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]'
              )}
              aria-hidden="true"
            />
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>

      {/* Desktop: Compact Floating Vertical Dock */}
      <nav
        aria-label="Repository navigation dock"
        className={cn(
          'hidden lg:flex flex-col gap-1 p-1.5 w-36 rounded-2xl bg-[var(--color-surface)]/95 backdrop-blur-md border border-[var(--color-border)] shadow-xl shrink-0',
          className
        )}
      >
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            aria-current={item.isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all font-medium select-none group',
              item.isActive
                ? 'bg-[var(--color-accent-tint)] text-[var(--color-accent)] font-semibold border border-[var(--color-accent-border)] shadow-xs'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/70'
            )}
          >
            <item.icon
              size={14}
              className={cn(
                'shrink-0 transition-transform group-hover:scale-105',
                item.isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)] group-hover:text-[var(--color-text)]'
              )}
              aria-hidden="true"
            />
            <span className="truncate">{item.name}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
