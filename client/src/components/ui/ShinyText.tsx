import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ShinyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  text: string;
  disabled?: boolean;
  speed?: number;
}

export function ShinyText({
  text,
  disabled = false,
  speed = 3,
  className = '',
  ...props
}: ShinyTextProps) {
  const animationDuration = `${speed}s`;

  return (
    <span
      className={cn(
        'inline-block bg-clip-text text-transparent',
        !disabled && 'animate-shimmer',
        className
      )}
      style={{
        backgroundImage:
          'linear-gradient(120deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.95) 50%, rgba(255, 255, 255, 0.4) 100%)',
        backgroundSize: '200% 100%',
        animationDuration,
      }}
      {...props}
    >
      {text}
    </span>
  );
}
