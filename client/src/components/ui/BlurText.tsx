import * as React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { cn } from '../../lib/utils';

export interface BlurTextProps extends HTMLMotionProps<'span'> {
  text: string;
  delay?: number;
  className?: string;
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom';
  threshold?: number;
}

export function BlurText({
  text,
  delay = 50,
  className = '',
  animateBy = 'words',
  direction = 'top',
  ...props
}: BlurTextProps) {
  const elements = animateBy === 'words' ? text.split(' ') : text.split('');

  const defaultFrom = {
    filter: 'blur(10px)',
    opacity: 0,
    y: direction === 'top' ? -20 : 20,
  };

  const defaultTo = {
    filter: 'blur(0px)',
    opacity: 1,
    y: 0,
  };

  return (
    <span className={cn('inline-flex flex-wrap', className)}>
      {elements.map((element, index) => (
        <motion.span
          key={index}
          initial={defaultFrom}
          animate={defaultTo}
          transition={{
            duration: 0.45,
            delay: (index * delay) / 1000,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="inline-block whitespace-pre"
          {...props}
        >
          {element}
          {animateBy === 'words' && index < elements.length - 1 && '\u00A0'}
        </motion.span>
      ))}
    </span>
  );
}
