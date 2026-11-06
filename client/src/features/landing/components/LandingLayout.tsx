import * as React from 'react';
import { LandingNav } from './LandingNav';
import { LineGutter } from './LineGutter';

interface LandingLayoutProps {
  activeSection?: string;
  children: React.ReactNode;
}

export const LandingLayout: React.FC<LandingLayoutProps> = ({
  activeSection = 'hero',
  children,
}) => {
  return (
    <div className="relative min-h-screen bg-[var(--color-landing-bg)] text-[var(--color-landing-ink)] font-[family-name:var(--font-display)] selection:bg-[var(--color-landing-accent-highlighter)] selection:text-[var(--color-landing-ink)]">
      {/* Signature fixed left line-number gutter (desktop only) */}
      <LineGutter activeSection={activeSection} />

      {/* Main navigation */}
      <LandingNav />

      {/* Main content with responsive layout */}
      <main className="relative lg:pl-12 w-full pt-16">
        {children}
      </main>
    </div>
  );
};
