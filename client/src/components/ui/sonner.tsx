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
            'group toast group-[.toaster]:bg-[#161615] group-[.toaster]:text-[var(--color-text,#F3F1EC)] group-[.toaster]:border-[rgba(255,255,255,0.12)] group-[.toaster]:shadow-2xl group-[.toaster]:rounded-xl group-[.toaster]:text-xs group-[.toaster]:font-sans group-[.toaster]:py-3 group-[.toaster]:px-3.5',
          description: 'group-[.toast]:text-[var(--color-muted,#A8A59D)] text-[11px]',
          actionButton:
            'group-[.toast]:bg-[var(--color-mint-accent,#B9E4D0)] group-[.toast]:text-[#0C0C0B] group-[.toast]:font-semibold text-xs rounded-lg',
          cancelButton:
            'group-[.toast]:bg-[var(--color-raised,#1C1C1A)] group-[.toast]:text-[var(--color-muted,#A8A59D)] text-xs rounded-lg',
          closeButton:
            'group-[.toast]:bg-[var(--color-raised,#1C1C1A)] group-[.toast]:border-[rgba(255,255,255,0.1)] group-[.toast]:text-[var(--color-muted,#A8A59D)] group-[.toast]:hover:text-[var(--color-text,#F3F1EC)]',
        },
      }}
      {...props}
    />
  );
};

export { toast };

