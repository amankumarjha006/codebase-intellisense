import * as React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { duration, ease } from '../../lib/motion';

interface AnimatedPageProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Page transition wrapper. Provides a gentle, micro-rise fade entrance and exit.
 * Automatically respects prefers-reduced-motion.
 */
export function AnimatedPage({ children, className = '' }: AnimatedPageProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -2 }}
      transition={{ duration: duration.page, ease: ease.out }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
