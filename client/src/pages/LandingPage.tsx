import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LandingLayout } from '../features/landing/components/LandingLayout';
import { useAuth } from '../lib/AuthContext';
import { LANDING_ERROR_COPY } from '../lib/errors';

export function LandingPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeSection, setActiveSection] = React.useState('hero');

  // If user is already logged in, redirect directly to dashboard
  React.useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, user, navigate]);

  const errorParam = searchParams.get('error');
  const errorCopy = errorParam ? LANDING_ERROR_COPY[errorParam] || null : null;

  // Track active section for line-number gutter
  React.useEffect(() => {
    const sectionIds = ['hero', 'demo', 'how-it-works', 'proof', 'wont-do', 'privacy', 'cta'];
    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveSection(id);
            }
          });
        },
        { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => {
      observers.forEach((obs) => obs.disconnect());
    };
  }, []);

  return (
    <LandingLayout activeSection={activeSection}>
      {/* Error notification banner if redirected with error */}
      {errorCopy && (
        <div
          role="alert"
          className="mb-8 p-4 rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-tint)] text-[var(--color-error)] text-sm flex items-center justify-between"
        >
          <p>{errorCopy}</p>
        </div>
      )}

      {/* 01 HERO SECTION (Scaffold for Step 2) */}
      <section
        id="hero"
        className="min-h-[75vh] flex flex-col justify-center py-16 lg:py-24"
      >
        <div className="max-w-4xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-[var(--color-landing-hairline-strong)] bg-[var(--color-landing-surface)] text-xs text-[var(--color-landing-ink-secondary)] mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-landing-accent)]" />
            <span>Recorded from fastapi/fastapi @ 69c67a1</span>
          </div>

          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-normal tracking-tight text-[var(--color-landing-ink)] leading-[1.05]">
            Ask the repo. <br />
            <span className="highlighter-sweep is-visible">Get the line.</span>
          </h1>

          <p className="mt-8 text-lg sm:text-xl text-[var(--color-landing-ink-secondary)] max-w-2xl leading-relaxed">
            Connect a public GitHub repository, ask in plain English, and get answers
            whose citations open the exact lines of code.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button
              onClick={() => {
                const el = document.getElementById('demo');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-sm font-medium text-[var(--color-landing-ink)] hover:text-[var(--color-landing-ink-secondary)] transition-colors inline-flex items-center space-x-1"
            >
              <span>See a real answer</span>
              <span aria-hidden="true">↓</span>
            </button>
          </div>
        </div>
      </section>

      {/* 02 INTERACTIVE DEMO (Scaffold for Step 3) */}
      <section id="demo" className="py-24 border-t border-[var(--color-landing-hairline)]">
        <div className="mb-8">
          <p className="text-xs font-[family-name:var(--font-code)] text-[var(--color-landing-ink-tertiary)] uppercase tracking-wider">
            02 // Interactive Demo
          </p>
          <h2 className="text-3xl sm:text-4xl font-normal tracking-tight mt-2 text-[var(--color-landing-ink)]">
            Verified Source Grounding
          </h2>
        </div>
        <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-8 text-[var(--panel-text)] min-h-[360px] flex items-center justify-center">
          <p className="text-sm text-[var(--panel-text-secondary)] font-[family-name:var(--font-code)]">
            [Interactive Cockpit Preview — Streamed tokens, question chips, Shiki pre-tokenized source viewer]
          </p>
        </div>
      </section>

      {/* 03 HOW IT WORKS (Scaffold for Step 4) */}
      <section id="how-it-works" className="py-24 border-t border-[var(--color-landing-hairline)]">
        <div className="mb-8">
          <p className="text-xs font-[family-name:var(--font-code)] text-[var(--color-landing-ink-tertiary)] uppercase tracking-wider">
            03 // Architecture & Indexing
          </p>
          <h2 className="text-3xl sm:text-4xl font-normal tracking-tight mt-2 text-[var(--color-landing-ink)]">
            How It Works
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {['01 Connect', '02 Index', '03 Ask', '04 Map'].map((chapter) => (
            <div
              key={chapter}
              className="p-6 rounded-lg border border-[var(--color-landing-hairline)] bg-[var(--color-landing-surface)]"
            >
              <h3 className="text-base font-medium text-[var(--color-landing-ink)]">{chapter}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* 04 PROOF (Scaffold for Step 5) */}
      <section id="proof" className="py-24 border-t border-[var(--color-landing-hairline)]">
        <div className="mb-8">
          <p className="text-xs font-[family-name:var(--font-code)] text-[var(--color-landing-ink-tertiary)] uppercase tracking-wider">
            04 // Verifiable Proof
          </p>
          <h2 className="text-3xl sm:text-4xl font-normal tracking-tight mt-2 text-[var(--color-landing-ink)]">
            Real Metrics from Real Repositories
          </h2>
        </div>
      </section>

      {/* 05 WHAT IT WON'T DO (Scaffold for Step 5) */}
      <section id="wont-do" className="py-24 border-t border-[var(--color-landing-hairline)]">
        <div className="mb-8">
          <p className="text-xs font-[family-name:var(--font-code)] text-[var(--color-landing-ink-tertiary)] uppercase tracking-wider">
            05 // Honest Boundaries
          </p>
          <h2 className="text-3xl sm:text-4xl font-normal tracking-tight mt-2 text-[var(--color-landing-ink)]">
            What It Won&apos;t Do
          </h2>
        </div>
      </section>

      {/* 06 PRIVACY (Scaffold for Step 5) */}
      <section id="privacy" className="py-24 border-t border-[var(--color-landing-hairline)]">
        <div className="mb-8">
          <p className="text-xs font-[family-name:var(--font-code)] text-[var(--color-landing-ink-tertiary)] uppercase tracking-wider">
            06 // Privacy & Transparency
          </p>
          <h2 className="text-3xl sm:text-4xl font-normal tracking-tight mt-2 text-[var(--color-landing-ink)]">
            Code Privacy by Architecture
          </h2>
        </div>
      </section>

      {/* 07 FINAL CTA (Scaffold for Step 5) */}
      <section id="cta" className="py-24 border-t border-[var(--color-landing-hairline)]">
        <div className="rounded-2xl p-12 bg-[var(--panel-bg)] text-[var(--panel-text)] text-center">
          <h2 className="text-3xl sm:text-5xl font-normal tracking-tight">
            Ground your codebase answers today.
          </h2>
        </div>
      </section>
    </LandingLayout>
  );
}
