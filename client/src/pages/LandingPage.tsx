import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LandingLayout } from '../features/landing/components/LandingLayout';
import { HeroSection } from '../features/landing/components/HeroSection';
import { InteractiveDemo } from '../features/landing/components/InteractiveDemo';
import { HowItWorksScrolly } from '../features/landing/components/HowItWorksScrolly';
import { ProofSection } from '../features/landing/components/ProofSection';
import { WontDoSection } from '../features/landing/components/WontDoSection';
import { PrivacySection } from '../features/landing/components/PrivacySection';
import { FinalCtaSection } from '../features/landing/components/FinalCtaSection';
import { LandingFooter } from '../features/landing/components/LandingFooter';
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
      <div className="max-w-[1280px] mx-auto px-6 sm:px-8 lg:px-12">
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
      </div>

      {/* 03 HOW IT WORKS (Scrollytelling & 3D Architecture Scene) */}
      <HowItWorksScrolly />

      {/* 04 PROOF (Benchmarked Evidence) */}
      <ProofSection />

      {/* 05 WHAT IT WON'T DO (Honest Boundaries & Real Refusal) */}
      <WontDoSection />

      {/* 06 PRIVACY & SECURITY (Factual Disclosures from PRIVACY_FACTS) */}
      <PrivacySection />

      {/* 07 FINAL CTA (Full-bleed Dark Section) */}
      <FinalCtaSection />

      {/* 08 FOOTER */}
      <LandingFooter />
    </LandingLayout>
  );
}
