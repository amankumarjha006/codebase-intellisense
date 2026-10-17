/**
 * Motion constants — shared durations, easings, and spring configs.
 * All motion in the app references these values.
 */

/** Standard durations in seconds */
export const duration = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.2,
  slow: 0.3,
  page: 0.15,
} as const;

/** Easing curves */
export const ease = {
  /** Default for most transitions */
  out: [0.22, 1, 0.36, 1] as const,
  /** For enter/appear animations */
  enter: [0, 0, 0.2, 1] as const,
  /** For exit/disappear animations */
  exit: [0.4, 0, 1, 1] as const,
  /** Smooth decel for scroll-linked */
  decel: [0, 0.55, 0.45, 1] as const,
} as const;

/** Spring configs */
export const spring = {
  /** Snappy for drawers and sheets */
  snappy: { type: 'spring' as const, stiffness: 400, damping: 30, mass: 1 },
  /** Gentle for layout shifts */
  gentle: { type: 'spring' as const, stiffness: 200, damping: 24, mass: 1 },
  /** Bouncy for popping elements */
  pop: { type: 'spring' as const, stiffness: 500, damping: 28, mass: 0.8 },
} as const;

/** Stagger delay between children in ms */
export const stagger = {
  fast: 0.03,
  normal: 0.04,
  slow: 0.06,
} as const;

/** Common animation variants */
export const variants = {
  /** Fade up for list items */
  fadeUp: {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0 },
  },
  /** Fade in for general reveals */
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  /** Scale pop for citation chips */
  scalePop: {
    hidden: { opacity: 0, scale: 0.96 },
    visible: { opacity: 1, scale: 1 },
  },
  /** Slide from right for drawers (desktop) */
  slideRight: {
    hidden: { x: '100%' },
    visible: { x: 0 },
    exit: { x: '100%' },
  },
  /** Slide from bottom for sheets (mobile) */
  slideUp: {
    hidden: { y: '100%' },
    visible: { y: 0 },
    exit: { y: '100%' },
  },
  /** Page transition */
  page: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  },
} as const;

/** Press scale for interactive elements */
export const pressScale = 0.98;

/** Parallax max offset in px */
export const parallaxMax = 12;
