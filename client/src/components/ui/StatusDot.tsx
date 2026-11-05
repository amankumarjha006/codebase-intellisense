import * as React from 'react';
import { cn } from '../../lib/utils';

export type StatusType = 'READY' | 'INDEXING' | 'ANALYZING' | 'QUEUED' | 'FETCHING' | 'FAILED' | 'NOT_INDEXED';

interface StatusDotProps {
  status: string | null | undefined;
  showText?: boolean;
  className?: string;
}

export function StatusDot({ status, showText = true, className }: StatusDotProps) {
  const norm = (status || 'NOT_INDEXED').toUpperCase();

  let colorClass = 'bg-[#6F757C]'; // tertiary
  let label = 'Not indexed';
  let isPulsing = false;

  if (norm === 'READY' || norm === 'SUCCESS') {
    colorClass = 'bg-[#81C995]';
    label = 'Ready';
  } else if (norm === 'FAILED') {
    colorClass = 'bg-[#F28B82]';
    label = 'Failed';
  } else if (['INDEXING', 'ANALYZING', 'QUEUED', 'FETCHING'].includes(norm)) {
    colorClass = 'bg-[#FDD663]';
    label = norm === 'QUEUED' ? 'Queued' : norm === 'ANALYZING' ? 'Analyzing' : 'Indexing';
    isPulsing = true;
  }

  // If status is ready and text is hidden, show nothing
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]', className)}>
      <span
        className={cn(
          'h-2 w-2 rounded-full shrink-0',
          colorClass,
          isPulsing && 'animate-pulse'
        )}
        aria-hidden="true"
      />
      {showText && <span>{label}</span>}
    </span>
  );
}
