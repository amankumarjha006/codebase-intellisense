import * as React from 'react';
import { cn } from '../../lib/utils';

interface TooltipContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  id: string;
}

const TooltipContext = React.createContext<TooltipContextType | null>(null);

export function TooltipProvider({
  children,
}: {
  children: React.ReactNode;
  delayDuration?: number;
  skipDelayDuration?: number;
}) {
  return <>{children}</>;
}

export function Tooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  return (
    <TooltipContext.Provider value={{ open, setOpen, id }}>
      <div
        className="relative inline-flex"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </div>
    </TooltipContext.Provider>
  );
}

export const TooltipTrigger = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & { asChild?: boolean }
>(({ asChild, children, ...props }, ref) => {
  const ctx = React.useContext(TooltipContext);
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      ref,
      'aria-describedby': ctx?.open ? ctx.id : undefined,
      ...props,
    });
  }
  return (
    <span ref={ref as React.Ref<HTMLSpanElement>} aria-describedby={ctx?.open ? ctx.id : undefined} {...props}>
      {children}
    </span>
  );
});
TooltipTrigger.displayName = 'TooltipTrigger';

export const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { side?: 'top' | 'right' | 'bottom' | 'left'; sideOffset?: number }
>(({ className, side = 'top', children, ...props }, ref) => {
  const ctx = React.useContext(TooltipContext);
  if (!ctx?.open) return null;

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  }[side];

  return (
    <div
      ref={ref}
      id={ctx.id}
      role="tooltip"
      className={cn(
        'pointer-events-none absolute z-50 whitespace-nowrap rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-raised)] px-2.5 py-1 text-xs text-[var(--color-text)] shadow-md animate-in fade-in-0 zoom-in-95',
        positionClasses,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
TooltipContent.displayName = 'TooltipContent';
