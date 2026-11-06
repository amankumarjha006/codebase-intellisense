import * as React from 'react';
import { useAuth } from '../../../lib/AuthContext';
import { API_URL } from '../../../lib/api';

export const LandingNav: React.FC = () => {
  const { user, signIn } = useAuth();
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-200 ${
        scrolled
          ? 'bg-[var(--color-landing-bg)]/90 backdrop-blur-md border-b border-[var(--color-landing-hairline)] shadow-[0_1px_3px_rgba(20,22,26,0.04)]'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-[1280px] mx-auto px-6 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <a
          href="#"
          className="flex items-center space-x-2 text-[var(--color-landing-ink)] font-medium text-base tracking-tight hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-landing-accent)] rounded"
        >
          <span className="w-5 h-5 rounded bg-[var(--color-landing-ink)] flex items-center justify-center text-[var(--color-landing-bg)] text-xs font-bold font-[family-name:var(--font-code)]">
            C
          </span>
          <span className="font-[family-name:var(--font-display)]">Codebase Intellisense</span>
        </a>

        {/* Section Navigation Links */}
        <nav className="hidden md:flex items-center space-x-8 text-sm text-[var(--color-landing-ink-secondary)] font-normal">
          <a
            href="#how-it-works"
            className="hover:text-[var(--color-landing-ink)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-landing-accent)] rounded px-1 py-0.5"
          >
            How it works
          </a>
          <a
            href="#proof"
            className="hover:text-[var(--color-landing-ink)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-landing-accent)] rounded px-1 py-0.5"
          >
            Proof
          </a>
          <a
            href="#privacy"
            className="hover:text-[var(--color-landing-ink)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-landing-accent)] rounded px-1 py-0.5"
          >
            Privacy
          </a>
        </nav>

        {/* Actions (Dev Login + Primary CTA) */}
        <div className="flex items-center space-x-3">
          {/* Dev Quick Login — strictly gated to development builds */}
          {import.meta.env.DEV && (
            <a
              href={`${API_URL}/auth/dev-login`}
              className="text-xs font-[family-name:var(--font-code)] px-2.5 py-1 rounded border border-amber-600/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              title="Development only: bypass GitHub OAuth with mock dev user"
            >
              Dev Quick Login
            </a>
          )}

          {/* Single primary CTA */}
          <button
            onClick={() => {
              if (user) {
                window.location.href = '/dashboard';
              } else {
                signIn();
              }
            }}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg text-[#0B0D10] bg-white hover:bg-slate-100 active:scale-[0.98] transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-landing-accent)] focus-visible:ring-offset-2"
          >
            Connect GitHub
          </button>
        </div>
      </div>
    </header>
  );
};

