import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Terminal,
  ArrowRight,
  ShieldCheck,
  Code2,
  Menu,
  ExternalLink,
  AlertTriangle,
  X,
  Link2,
  Fingerprint,
  Hash,
} from 'lucide-react';
import { GithubIcon } from '../components/ui/GithubIcon';
import { BlurText } from '../components/ui/BlurText';
import { SpotlightCard } from '../components/ui/SpotlightCard';
import { Dither } from '../components/ui/Dither';
import { Button } from '../components/ui/button';
import { Drawer, DrawerContent } from '../components/ui/drawer';
import { FadeUp, StaggerChildren, ScrollReveal } from '../components/ui/ScrollMotion';
import { SkipToContent } from '../components/ui/A11y';
import { API_URL } from '../lib/api';
import { LANDING_ERROR_COPY } from '../lib/errors';
import { useAuth } from '../lib/AuthContext';
import { ease } from '../lib/motion';

export function LandingPage() {
  const navigate = useNavigate();
  const { user, signIn } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [activeCitation, setActiveCitation] = React.useState(false);

  // If user is already logged in, redirect directly to dashboard
  React.useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const errorParam = searchParams.get('error');
  const errorCopy = errorParam ? LANDING_ERROR_COPY[errorParam] || null : null;

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSignIn = () => {
    signIn();
  };

  // Prevent flash of landing page content while redirecting
  if (user) {
    return null;
  }


  return (
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-text)] font-sans antialiased selection:bg-[var(--color-accent-tint)] selection:text-[var(--color-accent)]">
      <SkipToContent targetId="landing-main" />

      {/* Sticky Navigation */}
      <header
        className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 border-b ${
          scrolled
            ? 'bg-[var(--color-page)]/90 backdrop-blur-md border-[var(--color-border)] py-3'
            : 'bg-transparent border-transparent py-4'
        }`}
        role="banner"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border-strong)] flex items-center justify-center text-[var(--color-accent)]" aria-hidden="true">
              <Terminal size={17} />
            </div>
            <span className="text-sm font-bold tracking-tight text-[var(--color-text)]">
              Codebase Intellisense
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs text-[var(--color-text-secondary)] font-medium" aria-label="Landing page navigation">
            <a href="#how-it-works" className="hover:text-[var(--color-text)] transition">
              How it works
            </a>
            <a href="#features" className="hover:text-[var(--color-text)] transition">
              Features
            </a>
            <a href="#guarantees" className="hover:text-[var(--color-text)] transition">
              Guarantees
            </a>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-[var(--color-text)] transition flex items-center gap-1">
              <span>GitHub</span>
              <ExternalLink size={10} aria-hidden="true" />
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <Button size="sm" variant="primary" onClick={handleSignIn}>
              <GithubIcon size={14} />
              <span>Sign in with GitHub</span>
            </Button>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-[var(--radius-control)] text-[var(--color-muted)] hover:text-[var(--color-text)] md:hidden"
              aria-label="Open mobile menu"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      <Drawer open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DrawerContent side="right" className="p-6" aria-label="Mobile navigation">
          <div className="flex flex-col space-y-5 pt-8">
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium text-[var(--color-text)]"
            >
              How it works
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium text-[var(--color-text)]"
            >
              Features
            </a>
            <a
              href="#guarantees"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium text-[var(--color-text)]"
            >
              Guarantees
            </a>
            <div className="pt-4 border-t border-[var(--color-border)]">
              <Button onClick={handleSignIn} className="w-full">
                <GithubIcon size={15} />
                <span>Sign in with GitHub</span>
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Allowlisted Auth Error Banner */}
      {errorCopy && (
        <div className="max-w-4xl mx-auto pt-24 px-4 sm:px-6" role="alert">
          <div className="rounded-[var(--radius-control)] border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-3 text-xs text-[var(--color-danger)] flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" aria-hidden="true" />
              <span className="font-medium">{errorCopy}</span>
            </div>
            <button
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('error');
                setSearchParams(next, { replace: true });
              }}
              className="text-[var(--color-muted)] hover:text-[var(--color-text)] p-0.5 rounded transition"
              aria-label="Dismiss error"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <main id="landing-main">
        {/* Hero Section */}
        <section className={`${errorCopy ? 'pt-10' : 'pt-32'} pb-20 px-4 sm:px-6 relative overflow-hidden`} aria-labelledby="hero-heading">

          <div className="max-w-4xl mx-auto text-center space-y-6">
            <FadeUp delay={0}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--color-accent-border)] bg-[var(--color-accent-tint)] text-[var(--color-accent)] text-xs font-medium">
                <Terminal size={12} aria-hidden="true" />
                <span>AST Verification Engine v2.4.0</span>
              </div>
            </FadeUp>

            <h1 id="hero-heading" className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--color-text)] leading-[1.1]">
              <BlurText
                text="Answers that point to the line."
                animateBy="words"
                direction="top"
                className="justify-center"
              />
            </h1>

            <FadeUp delay={0.2}>
              <p className="text-sm sm:text-base text-[var(--color-text-secondary)] max-w-2xl mx-auto leading-relaxed">
                Deep codebase intelligence for distributed systems. Every architectural explanation, latency postmortem, and refactor plan strictly cited with absolute source references.
              </p>
            </FadeUp>

            <FadeUp delay={0.3}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Button size="lg" variant="primary" onClick={handleSignIn} className="w-full sm:w-auto">
                  <GithubIcon size={16} />
                  <span>Connect with GitHub</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </Button>
                <Button size="lg" variant="secondary" asChild className="w-full sm:w-auto">
                  <a href="#how-it-works">
                    View inspection traces
                  </a>
                </Button>
              </div>

              <div className="flex items-center justify-center gap-4 pt-3 text-[11px] text-[var(--color-muted)] font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" aria-hidden="true" />
                  Indexed in-memory
                </span>
                <span>Status: <strong className="text-[var(--color-text-secondary)]">Synchronized</strong></span>
              </div>
            </FadeUp>
          </div>

          {/* Interactive Demo Window */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: ease.out }}
            className="max-w-4xl mx-auto mt-14 rounded-[var(--radius-panel)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-2xl overflow-hidden"
            role="img"
            aria-label="Interactive demo showing a code query with verified citations"
          >
            {/* Window Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-raised)] border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2" aria-hidden="true">
                <span className="h-3 w-3 rounded-full bg-[#EF4444]/70" />
                <span className="h-3 w-3 rounded-full bg-[#F59E0B]/70" />
                <span className="h-3 w-3 rounded-full bg-[#10B981]/70" />
              </div>
              <div className="font-mono text-xs text-[var(--color-muted)] flex items-center gap-1.5">
                <span>workspace: /services/billing-ledger</span>
              </div>
              <div className="text-[11px] text-[var(--color-accent)] font-mono hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[var(--color-accent-border)] bg-[var(--color-accent-tint)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                Live Verification
              </div>
            </div>

            {/* Window Body — Two-Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              {/* Left: Query + Answer */}
              <div className="p-5 space-y-4 text-xs sm:text-sm border-r border-[var(--color-border)]">
                {/* Query Section */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-2">Query Analysis</div>
                  <p className="text-[var(--color-text)] font-medium leading-snug">
                    "Where does the ledger handle network partition retries without double-charging?"
                  </p>
                </div>

                {/* Verified Answer */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[var(--color-accent)] text-xs font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                    Guaranteed Atomic via ID
                  </div>
                  <p className="text-[var(--color-text-secondary)] text-xs leading-relaxed">
                    The transaction uses an idempotent hash lock acquired prior to DB insertion.
                  </p>
                </div>

                {/* Citation Chip */}
                <div className="pt-1">
                  <button
                    onClick={() => setActiveCitation(!activeCitation)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-control)] text-xs font-mono transition border ${
                      activeCitation
                        ? 'bg-[var(--color-accent)] text-[var(--color-page)] border-[var(--color-accent)] font-semibold'
                        : 'bg-[var(--color-accent-tint)] text-[var(--color-accent)] border-[var(--color-accent-border)] hover:bg-[var(--color-accent)]/20'
                    }`}
                    aria-pressed={activeCitation}
                    aria-label="Toggle source citation view"
                  >
                    <Link2 size={12} aria-hidden="true" />
                    <span>src/payments/idempotency.ts:42-58</span>
                  </button>
                </div>

                {/* AST Path */}
                <div className="text-[10px] font-mono text-[var(--color-muted)] pt-2 flex items-center justify-between border-t border-[var(--color-border)] mt-2">
                  <span>AST Path: LedgerEngine → 100% lockTx</span>
                  <span className="text-[var(--color-text-secondary)]">verified</span>
                </div>
              </div>

              {/* Right: Code Preview */}
              <div className="bg-[var(--color-page)]">
                <div className="flex items-center justify-between px-4 py-2 text-[11px] font-mono text-[var(--color-muted)] border-b border-[var(--color-border)]">
                  <span>src/payments/idempotency.ts</span>
                  <span className="text-[var(--color-text-secondary)]">TypeScript</span>
                </div>
                <div className="p-4 font-mono text-[11px] leading-relaxed text-[var(--color-text-secondary)] overflow-x-auto">
                  <div className="flex"><span className="text-[var(--color-muted)] w-7 shrink-0 text-right mr-3">40</span><span className="text-[var(--color-accent)]">export async function</span> <span className="text-[var(--color-text)]">handleCharge</span>(ctx) {'{'}</div>
                  <div className="flex"><span className="text-[var(--color-muted)] w-7 shrink-0 text-right mr-3">41</span>  const key = ctx.headers['x-idempotency-key'];</div>
                  <div className="flex bg-[var(--color-accent-tint)] -mx-4 px-4 border-l-2 border-[var(--color-accent)]"><span className="text-[var(--color-muted)] w-7 shrink-0 text-right mr-3">42</span>  <span className="text-[var(--color-accent)]">const</span> claim = <span className="text-[var(--color-accent)]">await</span> redis.set(key, 'PENDING',</div>
                  <div className="flex bg-[var(--color-accent-tint)] -mx-4 px-4 border-l-2 border-[var(--color-accent)]"><span className="text-[var(--color-muted)] w-7 shrink-0 text-right mr-3"></span>    'NX', 'EX', 120);</div>
                  <div className="flex bg-[var(--color-accent-tint)] -mx-4 px-4 border-l-2 border-[var(--color-accent)]"><span className="text-[var(--color-muted)] w-7 shrink-0 text-right mr-3">43</span>  <span className="text-[var(--color-accent)]">if</span> (!claim) <span className="text-[var(--color-accent)]">return</span> fetchCachedResult(key);</div>
                  <div className="flex"><span className="text-[var(--color-muted)] w-7 shrink-0 text-right mr-3">44</span>  <span className="text-[var(--color-accent)]">return</span> executeLedgerTx(ctx);</div>
                  <div className="flex"><span className="text-[var(--color-muted)] w-7 shrink-0 text-right mr-3">45</span>{'}'}</div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Stepper: How It Works */}
        <section id="how-it-works" className="py-20 px-4 sm:px-6 border-t border-[var(--color-border)] bg-[var(--color-surface)]/40" aria-labelledby="how-heading">
          <div className="max-w-4xl mx-auto space-y-12">
            <FadeUp>
              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Verification Pipeline
                </span>
                <h2 id="how-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)]">
                  Engineered for forensic codebase verification.
                </h2>
                <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] max-w-xl leading-relaxed">
                  Zero hallucinated file paths. Every semantic query maps to validated compiler-resolved AST nodes and commit snapshots.
                </p>
              </div>
            </FadeUp>

            <StaggerChildren className="grid grid-cols-1 md:grid-cols-3 gap-5" staggerDelay={0.08}>
              <SpotlightCard className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Step 01</span>
                  <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" aria-hidden="true" />
                </div>
                <h3 className="text-sm font-bold text-[var(--color-text)]">Abstract Syntax Graph Ingestion</h3>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Repositories are resolved through strict language server protocols (LSP) and Tree-sitter parsers into a deterministic semantic graph.
                </p>
                <div className="rounded-[var(--radius-control)] bg-[var(--color-page)] border border-[var(--color-border)] p-2.5 font-mono text-[11px] text-[var(--color-text-secondary)] space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span>{'>'} Parsing symbol definitions...</span>
                    <span className="text-[var(--color-accent)] font-semibold">AST verified</span>
                  </div>
                  <div className="text-[var(--color-muted)]">Found 4,812 interfaces · 0 broken links</div>
                </div>
              </SpotlightCard>

              <SpotlightCard className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Step 02</span>
                  <span className="h-2 w-2 rounded-full bg-[var(--color-muted)]" aria-hidden="true" />
                </div>
                <h3 className="text-sm font-bold text-[var(--color-text)]">Symbol & Flow Tracing</h3>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Traces method execution across RPC boundaries, async queues, and database schemas with explicit call-graph validation.
                </p>
                <div className="rounded-[var(--radius-control)] bg-[var(--color-page)] border border-[var(--color-border)] p-2.5 font-mono text-[11px] text-[var(--color-text-secondary)] space-y-0.5">
                  <div>Edge: POST /checkout → Queue → Kafka</div>
                  <div className="text-[var(--color-muted)]">Cross-repo reference: auth-serviceVerify</div>
                </div>
              </SpotlightCard>

              <SpotlightCard className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Step 03</span>
                  <span className="h-2 w-2 rounded-full bg-[var(--color-muted)]" aria-hidden="true" />
                </div>
                <h3 className="text-sm font-bold text-[var(--color-text)]">Citations on Every Answer</h3>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Responses never present naked claims. Every architectural assertion is linked to an exact line range in the commit SHA.
                </p>
                <div className="rounded-[var(--radius-control)] bg-[var(--color-page)] border border-[var(--color-border)] p-2.5 font-mono text-[11px] flex items-center justify-between">
                  <span className="text-[var(--color-muted)]">commit 9d42f8a</span>
                  <span className="px-2 py-0.5 rounded border border-[var(--color-accent-border)] bg-[var(--color-accent-tint)] text-[var(--color-accent)]">app.go:88-104</span>
                </div>
              </SpotlightCard>
            </StaggerChildren>
          </div>
        </section>

        {/* Guarantees Section */}
        <section id="guarantees" className="py-20 px-4 sm:px-6 border-t border-[var(--color-border)]" aria-labelledby="guarantees-heading">
          <div className="max-w-4xl mx-auto space-y-10">
            <FadeUp>
              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Core Architectural Guarantees
                </span>
                <h2 id="guarantees-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)]">
                  Grounded by design.
                </h2>
              </div>
            </FadeUp>

            <StaggerChildren className="grid grid-cols-1 sm:grid-cols-3 gap-5" staggerDelay={0.06}>
              <div className="p-5 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
                <div className="flex items-center justify-between">
                  <Fingerprint size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
                  <span className="text-xs font-mono text-[var(--color-muted)]">01</span>
                </div>
                <h4 className="text-sm font-bold text-[var(--color-text)]">Zero Synthetic Hallucinations</h4>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  If a symbol is absent from the parsed AST, the system explicitly returns non-resolution rather than extrapolating speculative logic.
                </p>
              </div>

              <div className="p-5 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
                <div className="flex items-center justify-between">
                  <ShieldCheck size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
                  <span className="text-xs font-mono text-[var(--color-muted)]">02</span>
                </div>
                <h4 className="text-sm font-bold text-[var(--color-text)]">Air-Gapped Indexing</h4>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Code vectors are indexed in transient memory bounds. No model retraining, customer code telemetry, or weights fine-tuning.
                </p>
              </div>

              <div className="p-5 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
                <div className="flex items-center justify-between">
                  <Hash size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
                  <span className="text-xs font-mono text-[var(--color-muted)]">03</span>
                </div>
                <h4 className="text-sm font-bold text-[var(--color-text)]">Branch Delta Diffs</h4>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Every query evaluates differences between main and your feature branches in real-time, surfacing silent contract regressions.
                </p>
              </div>
            </StaggerChildren>
          </div>
        </section>

        {/* Final CTA with Dither background */}
        <section className="py-24 px-4 sm:px-6 relative border-t border-[var(--color-border)] overflow-hidden" aria-labelledby="cta-heading">
          <Dither />
          <div className="max-w-3xl mx-auto relative z-10 space-y-6">
            <ScrollReveal>
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--color-accent-border)] bg-[var(--color-accent-tint)] text-[var(--color-accent)] text-xs font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" aria-hidden="true" />
                  Zero Configuration Required
                </div>
                <h2 id="cta-heading" className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--color-text)]">
                  Connect your first repository in seconds.
                </h2>
                <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] max-w-lg leading-relaxed">
                  Sync your private GitHub repositories with read-only tokens. AST builds initiate immediately without local container overhead.
                </p>
                <div className="flex flex-col sm:flex-row items-start gap-3 pt-2">
                  <Button size="lg" variant="primary" onClick={handleSignIn}>
                    <Code2 size={16} aria-hidden="true" />
                    <span>Continue with GitHub</span>
                  </Button>
                  <span className="text-[11px] text-[var(--color-muted)] font-mono self-center">
                    SOC2 Type II certified · Read-only permissions
                  </span>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 border-t border-[var(--color-border)] bg-[var(--color-page)] text-xs text-[var(--color-muted)]" role="contentinfo">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-[var(--color-accent)]" aria-hidden="true" />
            <span>Codebase Intellisense © 2026. All rights reserved.</span>
          </div>
          <nav className="flex items-center gap-6" aria-label="Footer navigation">
            <button onClick={() => navigate('/dashboard')} className="hover:text-[var(--color-text)] transition">
              Repository
            </button>
            <a href="#" className="hover:text-[var(--color-text)] transition">Status</a>
            <a href="#" className="hover:text-[var(--color-text)] transition">Documentation</a>
            <a href="#" className="hover:text-[var(--color-text)] transition">Security</a>
            <a href="#" className="hover:text-[var(--color-text)] transition">Terms</a>
          </nav>
        </div>
      </footer>

    </div>
  );
}
