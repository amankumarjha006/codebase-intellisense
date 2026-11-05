import { NavLink, useLocation } from 'react-router-dom';
import { MaterialIcon } from '../ui/MaterialIcon';
import { cn } from '../../lib/utils';

interface BottomNavProps {
  onOpenCommand: () => void;
  onOpenUserMenu?: () => void;
}

export function BottomNav({ onOpenCommand, onOpenUserMenu }: BottomNavProps) {
  const location = useLocation();

  const items = [
    { name: 'Home', path: '/dashboard', icon: 'home' },
    { name: 'Repositories', path: '/repositories', icon: 'folder' },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 h-[var(--height-bottomnav)] bg-[var(--color-surface)] border-t border-[var(--color-border)] z-40 flex items-center justify-around px-2 select-none"
      aria-label="Mobile Navigation"
    >
      {items.map((item) => {
        const isActive =
          item.path === '/dashboard'
            ? location.pathname === '/dashboard'
            : location.pathname.startsWith(item.path);

        return (
          <NavLink
            key={item.name}
            to={item.path}
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-[var(--radius-control)] transition-colors',
              isActive
                ? 'text-[var(--color-accent)] font-medium'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            )}
            aria-label={item.name}
          >
            <MaterialIcon name={item.icon} size={20} />
            <span className="text-[11px] leading-none">{item.name}</span>
          </NavLink>
        );
      })}

      {/* Mobile Search Trigger */}
      <button
        type="button"
        onClick={onOpenCommand}
        className="flex flex-col items-center justify-center gap-1 py-1 px-3 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
        aria-label="Search"
      >
        <MaterialIcon name="search" size={20} />
        <span className="text-[11px] leading-none">Search</span>
      </button>

      {/* User / Profile Trigger */}
      <button
        type="button"
        onClick={onOpenUserMenu}
        className="flex flex-col items-center justify-center gap-1 py-1 px-3 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
        aria-label="Account Menu"
      >
        <MaterialIcon name="person" size={20} />
        <span className="text-[11px] leading-none">Account</span>
      </button>
    </nav>
  );
}
