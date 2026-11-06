import * as React from 'react';
import { MaterialIcon } from './MaterialIcon';
import { useTheme } from '../../lib/ThemeContext';
import { cn } from '../../lib/utils';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'default';
  variant?: 'app' | 'landing';
}

export function ThemeToggle({
  className,
  size = 'default',
  variant = 'app',
}: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const isSmall = size === 'sm';
  const iconSize = isSmall ? 15 : 17;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'relative inline-flex items-center justify-center transition-all duration-200 focus-visible:outline-none cursor-pointer',
        isSmall ? 'h-7 w-7' : 'h-8 w-8',
        variant === 'landing'
          ? 'rounded-lg border border-[var(--color-landing-hairline-strong)] bg-[var(--color-landing-surface)] text-[var(--color-landing-ink)] hover:bg-[var(--color-landing-surface-dim)] focus-visible:ring-2 focus-visible:ring-[var(--color-landing-accent)]'
          : 'rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-raised)] text-[var(--color-text)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-accent)] focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]',
        className
      )}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme (Paper & Ink)' : 'Switch to dark theme'}
    >
      <span className="sr-only">
        {isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      </span>
      {isDark ? (
        <MaterialIcon
          name="light_mode"
          size={iconSize}
          className="transition-transform duration-300 hover:rotate-45 text-amber-300 dark:text-amber-300"
        />
      ) : (
        <MaterialIcon
          name="dark_mode"
          size={iconSize}
          className="transition-transform duration-300 hover:-rotate-12 text-[#14161A]"
        />
      )}
    </button>
  );
}

