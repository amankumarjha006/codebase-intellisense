import * as React from 'react';
import { motion } from 'motion/react';
import { duration, ease } from '../../lib/motion';

interface AnimatedPageProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Page transition wrapper. Wraps route content with a fade + vertical shift entrance.
 * Exit animation is handled by AnimatePresence in the parent router.
 */
export function AnimatedPage({ children, className = '' }: AnimatedPageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: duration.page, ease: ease.out }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
