import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-page)] disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-text)] text-[var(--color-page)] font-semibold hover:bg-[var(--color-text)]/90 shadow-sm',
        secondary:
          'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-raised)] hover:border-[var(--color-border-strong)]',
        outline:
          'border border-[var(--color-border)] bg-transparent text-[var(--color-text)] hover:bg-[var(--color-raised)] hover:border-[var(--color-border-strong)]',
        ghost:
          'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]',
        destructive:
          'text-[var(--color-error)] hover:bg-[var(--color-error-tint)] hover:text-[var(--color-error)] border border-transparent hover:border-[var(--color-error-border)]',
        link:
          'text-[var(--color-accent)] underline-offset-4 hover:underline p-0 h-auto font-normal',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-10 px-6 text-base',
        icon: 'h-9 w-9 p-0',
        'icon-sm': 'h-7 w-7 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
