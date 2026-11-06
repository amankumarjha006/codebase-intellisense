import * as React from 'react';

interface AnimatedPageProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Standard page wrapper. Works seamlessly with AppLayout's AnimatePresence route transitions.
 */
export function AnimatedPage({ children, className = '' }: AnimatedPageProps) {
  return (
    <div className={`w-full flex-1 flex flex-col min-h-0 ${className}`}>
      {children}
    </div>
  );
}
