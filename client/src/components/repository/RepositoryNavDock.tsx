import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MaterialIcon } from '../ui/MaterialIcon';
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
      iconName: 'search',
      isActive: currentPath.startsWith(`${basePath}/search`),
    },
    {
      name: 'Files',
      path: `${basePath}/files`,
      iconName: 'folder_open',
      isActive: currentPath.startsWith(`${basePath}/files`),
    },
  ];

  // If orientation is explicitly horizontal
  if (orientation === 'horizontal') {
    return (
      <nav
        aria-label="Repository navigation"
        className={cn(
          'flex items-center gap-1.5 p-1 rounded-xl bg-[var(--color-surface)]/90 backdrop-blur-md border border-[var(--color-border)] overflow-x-auto no-scrollbar',
          className
        )}
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
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/70'
            )}
          >
            <MaterialIcon
              name={item.iconName}
              active={item.isActive}
              size={20}
              className={cn(
                'shrink-0 transition-colors',
                !item.isActive && 'group-hover:text-[var(--color-mint-hover,#D0F1E0)]'
              )}
              aria-hidden={true}
            />
            <span className={item.isActive ? 'text-[var(--color-mint-accent,#B9E4D0)] font-semibold' : undefined}>
              {item.name}
            </span>
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
          'flex flex-col gap-1.5 p-1.5 w-38 rounded-2xl bg-[var(--color-surface)]/95 backdrop-blur-md border border-[var(--color-border)] shadow-xl shrink-0',
          className
        )}
      >
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            aria-current={item.isActive ? 'page' : undefined}
            className={cn(
              'group flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all font-medium select-none',
              item.isActive
                ? 'bg-[var(--color-mint-selected-bg,#253A32)] text-[var(--color-mint-accent,#B9E4D0)] font-semibold border border-[rgba(185,228,208,0.22)] shadow-xs'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/70'
            )}
          >
            <MaterialIcon
              name={item.iconName}
              active={item.isActive}
              size={20}
              className={cn(
                'shrink-0 transition-all group-hover:scale-105',
                !item.isActive && 'group-hover:text-[var(--color-mint-hover,#D0F1E0)]'
              )}
              aria-hidden={true}
            />
            <span className={cn('truncate', item.isActive && 'text-[var(--color-mint-accent,#B9E4D0)] font-semibold')}>
              {item.name}
            </span>
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
          'lg:hidden flex items-center gap-1.5 p-1 rounded-xl bg-[var(--color-surface)]/90 backdrop-blur-md border border-[var(--color-border)] overflow-x-auto no-scrollbar',
          className
        )}
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
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/70'
            )}
          >
            <MaterialIcon
              name={item.iconName}
              active={item.isActive}
              size={20}
              className={cn(
                'shrink-0 transition-colors',
                !item.isActive && 'group-hover:text-[var(--color-mint-hover,#D0F1E0)]'
              )}
              aria-hidden={true}
            />
            <span className={item.isActive ? 'text-[var(--color-mint-accent,#B9E4D0)] font-semibold' : undefined}>
              {item.name}
            </span>
          </Link>
        ))}
      </nav>

      {/* Desktop: Compact Floating Vertical Dock */}
      <nav
        aria-label="Repository navigation dock"
        className={cn(
          'hidden lg:flex flex-col gap-1.5 p-1.5 w-38 rounded-2xl bg-[var(--color-surface)]/95 backdrop-blur-md border border-[var(--color-border)] shadow-xl shrink-0',
          className
        )}
      >
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            aria-current={item.isActive ? 'page' : undefined}
            className={cn(
              'group flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all font-medium select-none',
              item.isActive
                ? 'bg-[var(--color-mint-selected-bg,#253A32)] text-[var(--color-mint-accent,#B9E4D0)] font-semibold border border-[rgba(185,228,208,0.22)] shadow-xs'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/70'
            )}
          >
            <MaterialIcon
              name={item.iconName}
              active={item.isActive}
              size={20}
              className={cn(
                'shrink-0 transition-all group-hover:scale-105',
                !item.isActive && 'group-hover:text-[var(--color-mint-hover,#D0F1E0)]'
              )}
              aria-hidden={true}
            />
            <span className={cn('truncate', item.isActive && 'text-[var(--color-mint-accent,#B9E4D0)] font-semibold')}>
              {item.name}
            </span>
          </Link>
        ))}
      </nav>
    </>
  );
}
