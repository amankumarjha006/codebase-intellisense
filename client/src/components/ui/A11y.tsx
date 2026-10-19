import * as React from 'react';

/**
 * Skip-to-content link for keyboard and screen reader users.
 * Invisible until focused, then slides into view.
 */
export function SkipToContent({ targetId = 'main-content' }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-[var(--radius-control)] focus:bg-[var(--color-accent)] focus:text-[var(--color-page)] focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-text)] focus:ring-offset-2 focus:ring-offset-[var(--color-page)]"
    >
      Skip to content
    </a>
  );
}

/**
 * Visually hidden live region for screen reader announcements.
 * Supports passing either string message or React children.
 */
export function LiveRegion({
  children,
  message,
  role = 'status',
  atomic = true,
}: {
  children?: React.ReactNode;
  message?: string;
  role?: 'status' | 'alert' | 'log';
  atomic?: boolean;
}) {
  const content = message || children;
  if (!content) return null;

  return (
    <div
      role={role}
      aria-live={role === 'alert' ? 'assertive' : 'polite'}
      aria-atomic={atomic}
      className="sr-only"
    >
      {content}
    </div>
  );
}
