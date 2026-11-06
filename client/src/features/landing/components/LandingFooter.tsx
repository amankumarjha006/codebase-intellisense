import React from 'react';
import { RepoMindLogo } from '../../../components/ui/RepoMindLogo';

export const LandingFooter: React.FC = () => {
  return (
    <footer className="py-12 border-t border-[var(--landing-hairline)] bg-[var(--landing-bg)] text-[var(--landing-ink-secondary)] text-xs">
      <div className="max-w-[1280px] mx-auto px-6 sm:px-8 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand & Mission */}
        <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <RepoMindLogo size={20} />
            <span className="font-display font-semibold text-sm text-[var(--landing-ink)] tracking-tight">
              Repo<span className="text-[var(--color-accent)]">Mind</span>
            </span>
          </div>
          <span className="hidden sm:inline text-[var(--landing-hairline-strong)]">|</span>
          <span>Verifiable codebase understanding with line-level citations.</span>
        </div>

        {/* Real Resolving Navigation Links */}
        <div className="flex flex-wrap items-center justify-center gap-6 font-mono text-xs">
          <a
            href="#how-it-works"
            className="hover:text-[var(--landing-ink)] transition-colors"
          >
            How it works
          </a>
          <a
            href="#proof"
            className="hover:text-[var(--landing-ink)] transition-colors"
          >
            Proof
          </a>
          <a
            href="#wont-do"
            className="hover:text-[var(--landing-ink)] transition-colors"
          >
            Limitations
          </a>
          <a
            href="#privacy"
            className="hover:text-[var(--landing-ink)] transition-colors"
          >
            Privacy
          </a>
          <a
            href="https://github.com/fastapi/fastapi"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--landing-ink)] hover:underline decoration-[var(--landing-accent)] transition-colors"
          >
            fastapi/fastapi (Apache 2.0)
          </a>
        </div>
      </div>
    </footer>
  );
};

