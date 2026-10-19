import * as React from 'react';
import { motion, useInView, type UseInViewOptions } from 'motion/react';
import { duration, ease, stagger as staggerConst } from '../../lib/motion';

/* ─── FadeUp ───────────────────────────────────────────────────────
   Scroll-triggered (or immediate) fade-up reveal.
   Wraps a single element.
   ─────────────────────────────────────────────────────────────────── */

interface FadeUpProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  /** Distance in px the element travels upward */
  distance?: number;
  /** If true, triggers only once (default). */
  once?: boolean;
  /** Viewport margin for triggering */
  margin?: UseInViewOptions['margin'];
}

export function FadeUp({
  children,
  className = '',
  delay = 0,
  distance = 16,
  once = true,
  margin = '-60px',
}: FadeUpProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: distance }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: distance }}
      transition={{ duration: duration.slow, delay, ease: ease.out }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── StaggerChildren ──────────────────────────────────────────────
   Container that staggers children entrance when scrolled into view.
   Each direct child gets a sequential delay.
   ─────────────────────────────────────────────────────────────────── */

interface StaggerChildrenProps {
  children: React.ReactNode;
  className?: string;
  /** Delay between each child in seconds */
  staggerDelay?: number;
  /** Distance each child travels upward */
  distance?: number;
  once?: boolean;
  as?: React.ElementType;
}

export function StaggerChildren({
  children,
  className = '',
  staggerDelay = staggerConst.normal,
  distance = 12,
  once = true,
  as: Tag = 'div',
}: StaggerChildrenProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: '-40px' });

  const childArray = React.Children.toArray(children);

  return (
    <Tag ref={ref} className={className}>
      {childArray.map((child, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: distance }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: distance }}
          transition={{
            duration: duration.slow,
            delay: index * staggerDelay,
            ease: ease.out,
          }}
        >
          {child}
        </motion.div>
      ))}
    </Tag>
  );
}

/* ─── ScrollReveal ─────────────────────────────────────────────────
   Simple opacity reveal on scroll. No vertical movement.
   Good for sections that should just softly appear.
   ─────────────────────────────────────────────────────────────────── */

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function ScrollReveal({ children, className = '', delay = 0 }: ScrollRevealProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: duration.slow, delay, ease: ease.out }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
