import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LandingLayout } from '../features/landing/components/LandingLayout';
import { HeroSection } from '../features/landing/components/HeroSection';
import { InteractiveDemo } from '../features/landing/components/InteractiveDemo';
import { HowItWorksScrolly } from '../features/landing/components/HowItWorksScrolly';
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

      {/* 01 HERO SECTION */}
      <HeroSection />

      {/* 02 INTERACTIVE DEMO */}
      <InteractiveDemo />

      {/* 03 HOW IT WORKS (Scrollytelling & 3D Architecture Scene) */}
      <HowItWorksScrolly />

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
