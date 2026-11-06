import React from 'react';
import refusalData from '../data/refusal.json';

export const WontDoSection: React.FC = () => {
  return (
    <section id="wont-do" className="relative py-24 md:py-36 border-t border-[var(--landing-hairline)] bg-[var(--landing-bg)]">
      <div className="max-w-[1280px] mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section Header */}
        <div className="max-w-2xl mb-16 md:mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-[var(--landing-surface-dim)] border border-[var(--landing-hairline)] text-xs font-mono text-[var(--landing-ink-secondary)]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            HONEST BOUNDARIES
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal text-[var(--landing-ink)] tracking-tight font-display mb-4">
            What Codebase Intellisense won&apos;t do
          </h2>
          <p className="text-base sm:text-lg text-[var(--landing-ink-secondary)] leading-relaxed">
            We believe developer tools must be uncompromisingly honest about their limitations. Here is what we refuse to do, what we cannot do, and how we handle missing context.
          </p>
        </div>

        {/* Real Recorded Refusal Card (Centerpiece of the section) */}
        <div className="mb-16 p-6 sm:p-8 rounded-2xl bg-[var(--panel-bg)] border border-[var(--panel-border)] shadow-xl text-[var(--panel-text)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 mb-6 border-b border-[var(--panel-border)]">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
                Recorded Real Refusal · Out-of-Index Query
              </span>
            </div>
            <div className="text-xs font-mono text-[var(--panel-text-secondary)]">
              Model: {refusalData.metadata.model} · Commit: {refusalData.metadata.commit.slice(0, 7)}
            </div>
          </div>

          {/* Real Query */}
          <div className="mb-6">
            <div className="text-xs font-mono text-[var(--panel-text-secondary)] uppercase mb-1.5">User Question</div>
            <div className="text-base sm:text-lg font-mono text-white p-4 rounded-lg bg-[var(--panel-surface)] border border-[var(--panel-border)]">
              &quot;{refusalData.query}&quot;
            </div>
          </div>

          {/* Real Recorded Answer */}
          <div>
            <div className="text-xs font-mono text-[var(--panel-text-secondary)] uppercase mb-1.5">
              System Response (Zero Hallucination)
            </div>
            <div className="p-5 rounded-lg bg-[var(--panel-raised)] border border-amber-500/20 text-slate-200 text-sm leading-relaxed whitespace-pre-line font-sans">
              {refusalData.answer}
            </div>
            <p className="mt-3 text-xs font-mono text-[var(--panel-text-secondary)]">
              When the repository does not contain the answer, our retrieval guardrails instruct the model to decline cleanly rather than hallucinate external library internals.
            </p>
          </div>
        </div>

        {/* 3 Explicit Boundaries Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {/* Boundary 1 */}
          <div className="p-8 rounded-xl bg-[var(--landing-surface)] border border-[var(--landing-hairline)]">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-mono font-bold text-sm mb-4">
              01
            </div>
            <h3 className="text-xl font-display font-medium text-[var(--landing-ink)] mb-3">
              No Distributed Tracing
            </h3>
            <p className="text-sm text-[var(--landing-ink-secondary)] leading-relaxed">
              Our architecture maps are static representations derived from directory layout, imports, and syntax trees. We do not trace runtime RPC calls, live queue pipelines, or production microservice telemetry.
            </p>
          </div>

          {/* Boundary 2 */}
          <div className="p-8 rounded-xl bg-[var(--landing-surface)] border border-[var(--landing-hairline)]">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-mono font-bold text-sm mb-4">
              02
            </div>
            <h3 className="text-xl font-display font-medium text-[var(--landing-ink)] mb-3">
              Pinned to Commit Snapshots
            </h3>
            <p className="text-sm text-[var(--landing-ink-secondary)] leading-relaxed">
              Answers and citations are grounded in the exact commit SHA indexed. If upstream code changes on GitHub, answers do not automatically update until a re-index is requested.
            </p>
          </div>

          {/* Boundary 3 */}
          <div className="p-8 rounded-xl bg-[var(--landing-surface)] border border-[var(--landing-hairline)]">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-mono font-bold text-sm mb-4">
              03
            </div>
            <h3 className="text-xl font-display font-medium text-[var(--landing-ink)] mb-3">
              Read-Only Access Only
            </h3>
            <p className="text-sm text-[var(--landing-ink-secondary)] leading-relaxed">
              We never ask for write permissions, pull request creation privileges, or repository administration rights. The application is strictly an intelligence layer, not a CI or commit bot.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
