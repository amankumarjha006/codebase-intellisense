import React from 'react';
import { CountUp } from './CountUp';
import proofData from '../data/proof.json';

export const ProofSection: React.FC = () => {
  return (
    <section id="proof" className="relative py-24 md:py-36 border-t border-[var(--landing-hairline)] bg-[var(--landing-bg)]">
      <div className="max-w-[1280px] mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section Header */}
        <div className="max-w-2xl mb-16 md:mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-[var(--landing-surface-dim)] border border-[var(--landing-hairline)] text-xs font-mono text-[var(--landing-ink-secondary)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            BENCHMARKED EVIDENCE
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal text-[var(--landing-ink)] tracking-tight font-display mb-4">
            Verifiable indexing benchmarks
          </h2>
          <p className="text-base sm:text-lg text-[var(--landing-ink-secondary)] leading-relaxed">
            Every metric below is extracted directly from our PostgreSQL knowledge store following automated AST parsing and vector generation on{' '}
            <a
              href={proofData.repositoryUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[var(--landing-ink)] underline decoration-[var(--landing-accent)] underline-offset-4 hover:text-[var(--landing-ink)]"
            >
              {proofData.repository}
            </a>
            .
          </p>
        </div>

        {/* 3 Core Metric Cards with CountUp */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-12">
          {/* Metric 1 */}
          <div className="p-8 rounded-xl bg-[var(--landing-surface)] border border-[var(--landing-hairline)] transition-all hover:border-[var(--landing-hairline-strong)]">
            <div className="text-xs font-mono uppercase tracking-wider text-[var(--landing-ink-tertiary)] mb-3">
              Source Files Analyzed
            </div>
            <div className="text-4xl sm:text-5xl lg:text-6xl font-display font-medium text-[var(--landing-ink)] tracking-tight mb-2">
              <CountUp to={proofData.sourceFilesAnalyzed} />
            </div>
            <p className="text-sm text-[var(--landing-ink-secondary)] leading-normal">
              Fully parsed AST source files ({proofData.pythonFiles.toLocaleString()} Python + {proofData.javascriptFiles} JavaScript).
            </p>
          </div>

          {/* Metric 2 */}
          <div className="p-8 rounded-xl bg-[var(--landing-surface)] border border-[var(--landing-hairline)] transition-all hover:border-[var(--landing-hairline-strong)]">
            <div className="text-xs font-mono uppercase tracking-wider text-[var(--landing-ink-tertiary)] mb-3">
              AST Symbols Extracted
            </div>
            <div className="text-4xl sm:text-5xl lg:text-6xl font-display font-medium text-[var(--landing-ink)] tracking-tight mb-2">
              <CountUp to={proofData.symbolsExtracted} />
            </div>
            <p className="text-sm text-[var(--landing-ink-secondary)] leading-normal">
              Structured functions, classes, and parameter definitions indexed with precise line ranges.
            </p>
          </div>

          {/* Metric 3 */}
          <div className="p-8 rounded-xl bg-[var(--landing-surface)] border border-[var(--landing-hairline)] transition-all hover:border-[var(--landing-hairline-strong)]">
            <div className="text-xs font-mono uppercase tracking-wider text-[var(--landing-ink-tertiary)] mb-3">
              Internal Imports Resolved
            </div>
            <div className="text-4xl sm:text-5xl lg:text-6xl font-display font-medium text-emerald-400 tracking-tight mb-2">
              <CountUp to={proofData.internalImportsResolvedPercent} decimals={1} suffix="%" />
            </div>
            <p className="text-sm text-[var(--landing-ink-secondary)] leading-normal">
              {proofData.resolvedInternalImports.toLocaleString()} of {proofData.totalInternalImports.toLocaleString()} internal imports mapped to resolved symbol definitions.
            </p>
          </div>
        </div>

        {/* Honest Disclosure & Non-Analyzed Files Breakdown */}
        <div className="p-6 sm:p-8 rounded-xl bg-[var(--landing-surface-dim)] border border-[var(--landing-hairline)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-5 border-b border-[var(--landing-hairline)]">
            <div>
              <h3 className="text-base font-medium text-[var(--landing-ink)] font-display">
                Transparent File Disclosure ({proofData.skippedFilesDisclosed} non-analyzed files)
              </h3>
              <p className="text-xs text-[var(--landing-ink-secondary)] mt-0.5">
                We only analyze source code. Documentation, configurations, and build scripts are explicitly disclosed:
              </p>
            </div>
            <div className="text-xs font-mono text-[var(--landing-ink-tertiary)] shrink-0">
              Snapshot: <span className="text-[var(--landing-ink)] font-semibold">{proofData.shortCommit}</span> · {proofData.indexedAt}
            </div>
          </div>

          {/* Breakdown tags */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="px-3 py-1.5 rounded-lg bg-[var(--landing-surface)] border border-[var(--landing-hairline)] text-[var(--landing-ink)]">
              Markdown: <strong className="text-[var(--landing-ink)]">{proofData.skippedBreakdown.markdown}</strong>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-[var(--landing-surface)] border border-[var(--landing-hairline)] text-[var(--landing-ink)]">
              YAML: <strong className="text-[var(--landing-ink)]">{proofData.skippedBreakdown.yaml}</strong>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-[var(--landing-surface)] border border-[var(--landing-hairline)] text-[var(--landing-ink)]">
              HTML: <strong className="text-[var(--landing-ink)]">{proofData.skippedBreakdown.html}</strong>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-[var(--landing-surface)] border border-[var(--landing-hairline)] text-[var(--landing-ink)]">
              Bash: <strong className="text-[var(--landing-ink)]">{proofData.skippedBreakdown.bash}</strong>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-[var(--landing-surface)] border border-[var(--landing-hairline)] text-[var(--landing-ink)]">
              CSS: <strong className="text-[var(--landing-ink)]">{proofData.skippedBreakdown.css}</strong>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-[var(--landing-surface)] border border-[var(--landing-hairline)] text-[var(--landing-ink)]">
              TOML: <strong className="text-[var(--landing-ink)]">{proofData.skippedBreakdown.toml}</strong>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

