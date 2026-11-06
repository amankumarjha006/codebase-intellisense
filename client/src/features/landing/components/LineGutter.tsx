import * as React from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';

interface LineGutterProps {
  activeSection?: string;
}

// Section anchor line numbers mapping to ~60 gutter rows
const SECTION_ANCHORS: Record<string, number> = {
  hero: 1,
  demo: 10,
  'how-it-works': 22,
  proof: 36,
  'wont-do': 45,
  privacy: 52,
  cta: 58,
};

export const LineGutter: React.FC<LineGutterProps> = ({ activeSection = 'hero' }) => {
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();

  // Subtle translation of 60 lines (max ~48px shift across full scroll range)
  const translateY = useTransform(scrollYProgress, [0, 1], [0, -48]);

  const activeLine = SECTION_ANCHORS[activeSection] ?? 1;

  // Generate fixed 60 line numbers (001 to 060)
  const lines = React.useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => i + 1);
  }, []);

  return (
    <aside
      aria-hidden="true"
      className="hidden lg:flex fixed left-0 top-0 bottom-0 w-12 z-20 flex-col items-center justify-start pt-20 pb-8 select-none pointer-events-none border-r border-[var(--color-landing-hairline)] bg-[var(--color-landing-bg)]/85 backdrop-blur-[2px]"
    >
      <motion.div
        style={shouldReduceMotion ? undefined : { y: translateY }}
        className="flex flex-col items-center space-y-1 font-[family-name:var(--font-code)] text-[10px] tracking-wider leading-none"
      >
        {lines.map((num) => {
          const isActive = num === activeLine;
          const formatted = String(num).padStart(3, '0');

          return (
            <div
              key={num}
              className={`relative flex items-center justify-end w-8 h-4 transition-colors duration-200 ${
                isActive
                  ? 'text-[var(--color-landing-ink)] font-bold'
                  : 'text-[var(--color-landing-ink-tertiary)] opacity-60 font-normal'
              }`}
            >
              {isActive && (
                <span className="absolute -left-1 w-1.5 h-1.5 rounded-full bg-[var(--color-landing-accent)] shadow-[0_0_8px_var(--color-landing-accent)]" />
              )}
              <span>{formatted}</span>
            </div>
          );
        })}
      </motion.div>
    </aside>
  );
};
