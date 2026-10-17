import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CheckCircle2, AlertCircle, Loader2, CircleSlash, Sparkles, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { JobStatus } from '../../lib/types';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[var(--color-raised)] text-[var(--color-text-secondary)] border border-[var(--color-border)]',
        accent: 'bg-[var(--color-accent-tint)] text-[var(--color-accent)] border border-[var(--color-accent-border)]',
        success: 'bg-[var(--color-success-tint)] text-[var(--color-success)] border border-[rgba(74,222,128,0.3)]',
        warning: 'bg-[var(--color-warning-tint)] text-[var(--color-warning)] border border-[rgba(251,191,36,0.3)]',
        error: 'bg-[var(--color-error-tint)] text-[var(--color-error)] border border-[var(--color-error-border)]',
        outline: 'text-[var(--color-muted)] border border-[var(--color-border)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export interface StatusChipProps {
  status: JobStatus | 'NOT_INDEXED' | 'QUEUED' | null;
  className?: string;
  size?: 'sm' | 'md';
}

export function StatusChip({ status, className, size = 'sm' }: StatusChipProps) {
  const isSm = size === 'sm';
  const iconSize = isSm ? 12 : 14;

  switch (status) {
    case 'READY':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 font-medium rounded-full border border-[var(--color-accent-border)] bg-[var(--color-accent-tint)] text-[var(--color-accent)]',
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
            className
          )}
        >
          <CheckCircle2 size={iconSize} className="shrink-0 text-[var(--color-accent)]" />
          <span>Ready</span>
        </span>
      );

    case 'INDEXING':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 font-medium rounded-full border border-[rgba(251,191,36,0.35)] bg-[var(--color-warning-tint)] text-[var(--color-warning)]',
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
            className
          )}
        >
          <Loader2 size={iconSize} className="shrink-0 animate-spin text-[var(--color-warning)]" />
          <span>Indexing</span>
        </span>
      );

    case 'FETCHING':
    case 'ANALYZING':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 font-medium rounded-full border border-[rgba(251,191,36,0.35)] bg-[var(--color-warning-tint)] text-[var(--color-warning)]',
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
            className
          )}
        >
          <Sparkles size={iconSize} className="shrink-0 animate-pulse text-[var(--color-warning)]" />
          <span className="capitalize">{status.toLowerCase()}</span>
        </span>
      );

    case 'QUEUED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 font-medium rounded-full border border-[var(--color-border)] bg-[var(--color-raised)] text-[var(--color-text-secondary)]',
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
            className
          )}
        >
          <Clock size={iconSize} className="shrink-0 text-[var(--color-muted)]" />
          <span>Queued</span>
        </span>
      );

    case 'FAILED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 font-medium rounded-full border border-[var(--color-error-border)] bg-[var(--color-error-tint)] text-[var(--color-error)]',
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
            className
          )}
        >
          <AlertCircle size={iconSize} className="shrink-0 text-[var(--color-error)]" />
          <span>Failed</span>
        </span>
      );

    case 'NOT_INDEXED':
    default:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 font-medium rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)]',
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
            className
          )}
        >
          <CircleSlash size={iconSize} className="shrink-0 text-[var(--color-muted)]" />
          <span>Not indexed</span>
        </span>
      );
  }
}
