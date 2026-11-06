import * as React from 'react';
import { cn } from '../../lib/utils';

export interface RepoMindLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  showText?: boolean;
  withBadge?: boolean;
  className?: string;
  badgeClassName?: string;
}

/**
 * RepoMind Brand Logo Mark
 * Represents a Git repository graph (root commit, branch DAG)
 * fused with a neural mind network (synaptic loops & intelligence apex).
 */
export function RepoMindLogo({
  size = 24,
  showText = false,
  withBadge = true,
  className,
  badgeClassName,
  ...props
}: RepoMindLogoProps) {
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 transition-transform duration-200', className)}
      aria-hidden="true"
      {...props}
    >
      {/* Optional squircle backdrop */}
      {withBadge && (
        <rect
          width="32"
          height="32"
          rx="7"
          className={cn(
            'fill-[var(--color-surface-raised,#171B22)] stroke-[var(--color-border,rgba(255,255,255,0.1))]',
            badgeClassName
          )}
          strokeWidth="1"
        />
      )}

      {/* Main repository trunk */}
      <path
        d="M16 25V17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Left mind lobe / branch */}
      <path
        d="M16 17C12 17 8.5 14 8.5 10.5C8.5 7 12 5.5 16 7.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />

      {/* Right mind lobe / branch */}
      <path
        d="M16 17C20 17 23.5 14 23.5 10.5C23.5 7 20 5.5 16 7.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />

      {/* Synaptic cross-link bridge */}
      <path
        d="M11 12H21"
        stroke="var(--color-accent, #8AB4F8)"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeDasharray="1.5 2.5"
      />

      {/* Root commit node */}
      <circle cx="16" cy="24.5" r="2.2" fill="var(--color-accent, #8AB4F8)" />

      {/* Left and right neural synapse nodes */}
      <circle cx="8.5" cy="10.5" r="1.8" fill="currentColor" />
      <circle cx="23.5" cy="10.5" r="1.8" fill="currentColor" />

      {/* Apex intelligence node */}
      <circle cx="16" cy="7.5" r="2.2" fill="var(--color-accent, #8AB4F8)" />

      {/* Central branch fork node */}
      <circle cx="16" cy="17" r="1.6" fill="currentColor" />
    </svg>
  );

  if (!showText) {
    return mark;
  }

  return (
    <div className="inline-flex items-center gap-2 select-none">
      {mark}
      <span className="font-semibold text-sm tracking-tight text-[var(--color-text)] font-[family-name:var(--font-display)]">
        Repo<span className="text-[var(--color-accent)]">Mind</span>
      </span>
    </div>
  );
}

