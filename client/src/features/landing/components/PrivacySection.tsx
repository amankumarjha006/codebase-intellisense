import React from 'react';
import { PRIVACY_FACTS } from '../data/privacy';

export const PrivacySection: React.FC = () => {
  return (
    <section id="privacy" className="relative py-24 md:py-36 border-t border-[var(--landing-hairline)] bg-[var(--landing-surface)]">
      <div className="max-w-[1280px] mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section Header */}
        <div className="max-w-2xl mb-16 md:mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-[var(--landing-surface-dim)] border border-[var(--landing-hairline)] text-xs font-mono text-[var(--landing-ink-secondary)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--landing-accent)]" />
            SECURITY & PRIVACY
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal text-[var(--landing-ink)] tracking-tight font-display mb-4">
            Factual privacy architecture
          </h2>
          <p className="text-base sm:text-lg text-[var(--landing-ink-secondary)] leading-relaxed">
            No vague marketing claims. Below is the exact technical reality of how your data, repository code, and authentication tokens are handled.
          </p>
        </div>

        {/* 4 Privacy Facts Grid mapped directly from PRIVACY_FACTS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-12">
          {PRIVACY_FACTS.map((fact, idx) => (
            <div
              key={fact.topic}
              className="p-8 rounded-xl bg-[var(--landing-bg)] border border-[var(--landing-hairline)] transition-all hover:border-[var(--landing-hairline-strong)] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--landing-surface-dim)] text-[var(--landing-ink-secondary)]">
                    Fact 0{idx + 1}
                  </span>
                  <span className="text-xs font-mono text-[var(--landing-ink-tertiary)] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Verified
                  </span>
                </div>
                <h3 className="text-xl font-display font-medium text-[var(--landing-ink)] mb-3">
                  {fact.topic}
                </h3>
                <p className="text-sm text-[var(--landing-ink-secondary)] leading-relaxed">
                  {fact.detail}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[var(--landing-hairline)] flex items-center justify-between text-xs font-mono text-[var(--landing-ink-tertiary)]">
                <span>Code Evidence:</span>
                <span className="text-[var(--landing-ink)] font-semibold">{fact.evidence}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Important Transparency Notice */}
        <div className="p-6 rounded-xl bg-[var(--landing-surface-dim)] border border-[var(--landing-hairline)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <div className="text-[var(--landing-ink-secondary)] leading-relaxed">
            <strong className="text-[var(--landing-ink)] font-semibold">LLM Provider Transparency:</strong> Code chunks are submitted to the configured model API (e.g. Google Gemini) at query time. Terms of service and data retention follow the active provider agreement. We make no unsubstantiated zero-retention claims.
          </div>
          <span className="shrink-0 font-mono text-[var(--landing-ink-tertiary)]">
            Open architecture
          </span>
        </div>
      </div>
    </section>
  );
};
