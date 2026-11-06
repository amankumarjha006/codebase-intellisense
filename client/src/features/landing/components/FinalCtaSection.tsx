import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useAuth } from '../../../lib/AuthContext';

export const FinalCtaSection: React.FC = () => {
  const { signIn } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  const handleConnect = () => {
    signIn();
  };

  return (
    <section id="cta" className="relative py-28 md:py-40 bg-[var(--panel-bg)] text-[var(--panel-text)] border-t border-[var(--panel-border)] overflow-hidden">
      {/* Subtle radial glow in background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[var(--landing-accent)] opacity-[0.06] blur-[120px] pointer-events-none rounded-full" />

      <div className="relative max-w-[1280px] mx-auto px-6 sm:px-8 lg:px-12 text-center">
        <div className="max-w-3xl mx-auto">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-[var(--panel-text-secondary)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--landing-accent)]" />
            ZERO FABRICATION · VERIFIED EVIDENCE
          </div>

          {/* Heading */}
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-normal tracking-tight font-display text-white mb-6 leading-tight">
            Ask the repo. <br className="hidden sm:inline" />
            Get the exact line.
          </h2>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-[var(--panel-text-secondary)] max-w-xl mx-auto mb-10 leading-relaxed font-sans">
            Connect any public GitHub repository. Get precise answers with clickable citations that open the exact source lines.
          </p>

          {/* Primary CTA Button */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.button
              onClick={handleConnect}
              whileHover={shouldReduceMotion ? undefined : { scale: 1.02, y: -2 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-medium text-base text-[#0B0D10] bg-white hover:bg-slate-100 transition-colors shadow-xl focus:outline-none focus:ring-2 focus:ring-[var(--landing-accent)]"
            >
              <svg className="w-5 h-5 text-[#0B0D10]" viewBox="0 0 24 24" fill="currentColor">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"
                />
              </svg>
              <span>Connect GitHub</span>
            </motion.button>
          </div>

          <p className="mt-5 text-xs font-mono text-[var(--panel-text-secondary)]">
            Read-only authentication (user:email) · Public repositories only
          </p>
        </div>
      </div>
    </section>
  );
};
