import * as React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useAuth } from '../../../lib/AuthContext';
import proofData from '../data/proof.json';

export const HeroSection: React.FC = () => {
  const { user, signIn } = useAuth();
  const shouldReduceMotion = useReducedMotion();
  const [sweepActive, setSweepActive] = React.useState(false);

  React.useEffect(() => {
    // Trigger highlighter sweep after headline reveals
    const timer = setTimeout(() => {
      setSweepActive(true);
    }, shouldReduceMotion ? 0 : 700);
    return () => clearTimeout(timer);
  }, [shouldReduceMotion]);

  const words = ['Ask', 'the', 'repo.', 'Get', 'the', 'line.'];

  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="relative min-h-[78vh] flex flex-col justify-center py-16 lg:py-24"
    >
      <div className="max-w-4xl">
        {/* Provenance Tag */}
        <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full border border-[var(--color-landing-hairline-strong)] bg-[var(--color-landing-surface)] text-xs text-[var(--color-landing-ink-secondary)] mb-8 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-[var(--color-landing-accent)] animate-pulse" />
          <span>
            Recorded from{' '}
            <a
              href={proofData.repositoryUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[var(--color-landing-ink)] hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-landing-accent)] rounded"
            >
              {proofData.repository}
            </a>{' '}
            @ <code className="font-[family-name:var(--font-code)] font-semibold">{proofData.shortCommit}</code>
          </span>
        </div>

        {/* Masked Headline Reveal */}
        <h1
          id="hero-heading"
          className="text-5xl sm:text-7xl lg:text-8xl font-normal tracking-tight text-[var(--color-landing-ink)] leading-[1.05]"
        >
          {shouldReduceMotion ? (
            <span>
              Ask the repo. <br />
              <span className="highlighter-sweep is-visible">Get the line.</span>
            </span>
          ) : (
            <span className="flex flex-wrap items-baseline">
              <span className="inline-flex space-x-3 sm:space-x-4 mr-4 overflow-hidden py-1">
                {words.slice(0, 3).map((w, idx) => (
                  <motion.span
                    key={idx}
                    initial={{ y: '115%', opacity: 0 }}
                    animate={{ y: '0%', opacity: 1 }}
                    transition={{
                      duration: 0.65,
                      delay: idx * 0.06,
                      ease: [0.2, 0.8, 0.2, 1],
                    }}
                    className="inline-block"
                  >
                    {w}
                  </motion.span>
                ))}
              </span>
              <br className="basis-full h-0" />
              <span className="inline-flex space-x-3 sm:space-x-4 overflow-hidden py-1">
                {words.slice(3, 5).map((w, idx) => (
                  <motion.span
                    key={idx}
                    initial={{ y: '115%', opacity: 0 }}
                    animate={{ y: '0%', opacity: 1 }}
                    transition={{
                      duration: 0.65,
                      delay: (idx + 3) * 0.06,
                      ease: [0.2, 0.8, 0.2, 1],
                    }}
                    className="inline-block"
                  >
                    {w}
                  </motion.span>
                ))}
                <motion.span
                  initial={{ y: '115%', opacity: 0 }}
                  animate={{ y: '0%', opacity: 1 }}
                  transition={{
                    duration: 0.65,
                    delay: 5 * 0.06,
                    ease: [0.2, 0.8, 0.2, 1],
                  }}
                  className={`inline-block highlighter-sweep ${sweepActive ? 'is-visible' : ''}`}
                >
                  line.
                </motion.span>
              </span>
            </span>
          )}
        </h1>

        {/* Subline */}
        <p className="mt-8 text-lg sm:text-xl text-[var(--color-landing-ink-secondary)] max-w-2xl leading-relaxed font-normal">
          Connect a public GitHub repository, ask in plain English, and get answers whose
          citations open the exact lines of code.
        </p>

        {/* Action Controls */}
        <div className="mt-10 flex flex-wrap items-center gap-5">
          <button
            onClick={() => {
              if (user) {
                window.location.href = '/dashboard';
              } else {
                signIn();
              }
            }}
            className="inline-flex items-center justify-center px-6 py-3.5 text-base font-medium rounded-xl text-[#0B0D10] bg-white hover:bg-slate-100 active:scale-[0.98] transition-all shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-landing-accent)] focus-visible:ring-offset-2"
          >
            Connect GitHub
          </button>

          <button
            onClick={() => {
              const el = document.getElementById('demo');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-4 py-3 text-sm font-medium text-[var(--color-landing-ink-secondary)] hover:text-[var(--color-landing-ink)] transition-colors inline-flex items-center space-x-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-landing-accent)] rounded-lg"
          >
            <span>See a real answer</span>
            <span aria-hidden="true">↓</span>
          </button>
        </div>
      </div>
    </section>
  );
};

