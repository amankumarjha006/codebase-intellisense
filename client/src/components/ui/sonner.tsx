import * as React from 'react';
import { Toaster as Sonner, toast } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

export const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      className="toaster group"
      richColors={false}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-[var(--color-surface)] group-[.toaster]:text-[var(--color-text)] group-[.toaster]:border-[var(--color-border-strong)] group-[.toaster]:shadow-2xl group-[.toaster]:rounded-xl group-[.toaster]:text-xs group-[.toaster]:font-sans group-[.toaster]:py-3 group-[.toaster]:px-3.5',
          description: 'group-[.toast]:text-[var(--color-text-secondary)] text-[11px]',
          actionButton:
            'group-[.toast]:bg-[var(--color-accent)] group-[.toast]:text-[#0B0D10] group-[.toast]:font-semibold text-xs rounded-lg',
          cancelButton:
            'group-[.toast]:bg-[var(--color-raised)] group-[.toast]:text-[var(--color-text-secondary)] text-xs rounded-lg',
          closeButton:
            'group-[.toast]:bg-[var(--color-raised)] group-[.toast]:border-[var(--color-border)] group-[.toast]:text-[var(--color-text-secondary)] group-[.toast]:hover:text-[var(--color-text)]',
        },
      }}
      {...props}
    />
  );
};

export { toast };

