import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mint-accent,#B9E4D0)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-page)] disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98] cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-mint-accent,#B9E4D0)] text-[#0C0C0B] hover:bg-[var(--color-mint-hover,#D0F1E0)] shadow-sm hover:shadow-[0_0_20px_rgba(185,228,208,0.25)]',
        secondary:
          'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-raised)] hover:border-[var(--color-mint-accent,#B9E4D0)]/40 hover:text-[var(--color-mint-accent,#B9E4D0)]',
        outline:
          'border border-[var(--color-mint-accent,#B9E4D0)]/40 bg-transparent text-[var(--color-mint-accent,#B9E4D0)] hover:bg-[var(--color-mint-selected-bg,#1B332A)] hover:border-[var(--color-mint-accent,#B9E4D0)]',
        ghost:
          'text-[var(--color-text-secondary)] hover:text-[var(--color-mint-accent,#B9E4D0)] hover:bg-[var(--color-raised)]',
        destructive:
          'text-[var(--color-error)] hover:bg-[var(--color-error-tint)] hover:text-[var(--color-error)] border border-transparent hover:border-[var(--color-error-border)]',
        link:
          'text-[var(--color-mint-accent,#B9E4D0)] underline-offset-4 hover:underline p-0 h-auto font-normal',
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
