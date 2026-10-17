import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Terminal,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Code2,
  Sparkles,
  Layers,
  FileCode,
  Menu,
  ExternalLink,
  AlertTriangle,
  X,
} from 'lucide-react';
import { GithubIcon } from '../components/ui/GithubIcon';
import { BlurText } from '../components/ui/BlurText';
import { SpotlightCard } from '../components/ui/SpotlightCard';
import { Dither } from '../components/ui/Dither';
import { Button } from '../components/ui/button';
import { Drawer, DrawerContent } from '../components/ui/drawer';
import { ScenarioSwitcher } from '../components/ui/ScenarioSwitcher';
import { API_URL } from '../lib/api';
import { LANDING_ERROR_COPY } from '../lib/errors';
import { useAuth } from '../lib/AuthContext';

export function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
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
    window.location.href = `${API_URL}/auth/github`;
  };

  // Prevent flash of landing page content while redirecting
  if (user) {
    return null;
  }


  return (
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-text)] font-sans antialiased selection:bg-[var(--color-accent-tint)] selection:text-[var(--color-accent)]">
      {/* Sticky Navigation */}
      <header
        className={`fixed top-0 inset-x-0 z-40 transition-all duration-200 border-b ${
          scrolled
            ? 'bg-[var(--color-page)]/90 backdrop-blur-md border-[var(--color-border)] py-3'
            : 'bg-transparent border-transparent py-4'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border-strong)] flex items-center justify-center text-[var(--color-accent)]">
              <Terminal size={17} />
            </div>
            <span className="text-sm font-bold tracking-tight text-[var(--color-text)]">
              Codebase Intellisense
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs text-[var(--color-text-secondary)] font-medium">
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
              <ExternalLink size={10} />
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate('/dashboard')}
              className="hidden sm:inline-flex"
            >
              Live Demo
            </Button>
            <Button size="sm" variant="primary" onClick={handleSignIn}>
              <GithubIcon size={14} />
              <span>Sign in with GitHub</span>
            </Button>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-[var(--radius-control)] text-[var(--color-muted)] hover:text-[var(--color-text)] md:hidden"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      <Drawer open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DrawerContent side="right" className="p-6">
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
        <div className="max-w-4xl mx-auto pt-24 px-4 sm:px-6">
          <div className="rounded-[var(--radius-control)] border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-3 text-xs text-[var(--color-danger)] flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
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

      {/* Hero Section */}
      <section className={`${errorCopy ? 'pt-10' : 'pt-32'} pb-20 px-4 sm:px-6 relative overflow-hidden`}>

        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--color-accent-border)] bg-[var(--color-accent-tint)] text-[var(--color-accent)] text-xs font-medium">
            <Sparkles size={12} />
            <span>Grounded Code Intelligence — Zero Hallucination</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--color-text)] leading-[1.1]">
            <BlurText
              text="Ask your codebase anything. Verify every line."
              animateBy="words"
              direction="top"
              className="justify-center"
            />
          </h1>

          <p className="text-sm sm:text-base text-[var(--color-text-secondary)] max-w-2xl mx-auto leading-relaxed">
            Query complex GitHub repositories with natural language. Every answer is synthesized with Tree-sitter AST awareness and strictly grounded with citations to exact files and line ranges.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button size="lg" variant="primary" onClick={handleSignIn} className="w-full sm:w-auto">
              <GithubIcon size={16} />
              <span>Connect with GitHub</span>
              <ArrowRight size={15} />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/repositories/repo_codebase_intellisense')}
              className="w-full sm:w-auto"
            >
              Explore Sample Repo
            </Button>
          </div>
        </div>

        {/* Interactive Demo Window */}
        <div className="max-w-4xl mx-auto mt-14 rounded-[var(--radius-panel)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-2xl overflow-hidden">
          {/* Window Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-raised)] border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#EF4444]/70" />
              <span className="h-3 w-3 rounded-full bg-[#F59E0B]/70" />
              <span className="h-3 w-3 rounded-full bg-[#10B981]/70" />
            </div>
            <div className="font-mono text-xs text-[var(--color-muted)] flex items-center gap-1.5">
              <span>repo: amankumarjha006/codebase-intellisense</span>
              <span className="text-[var(--color-accent)]">@ 3a8f1c2</span>
            </div>
            <div className="text-[11px] text-[var(--color-muted)] font-mono hidden sm:block">
              ast-verified
            </div>
          </div>

          {/* Window Body */}
          <div className="p-6 space-y-5 text-left text-xs sm:text-sm">
            {/* User message */}
            <div className="flex items-start gap-3 bg-[var(--color-page)] p-3.5 rounded-[var(--radius-control)] border border-[var(--color-border)]">
              <div className="h-6 w-6 rounded-full bg-[var(--color-raised)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text)] shrink-0">
                U
              </div>
              <div>
                <p className="text-[var(--color-text)] font-medium">
                  How does the indexing pipeline handle AST node chunking and preserve the parent-child hierarchy?
                </p>
              </div>
            </div>

            {/* AI Assistant Answer */}
            <div className="space-y-3.5 pl-1 sm:pl-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-accent)]">
                <Sparkles size={14} />
                <span>Grounded Answer</span>
              </div>

              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                The indexing pipeline uses <span className="text-[var(--color-text)] font-mono text-xs">Tree-sitter</span> to extract semantic boundaries. Instead of splitting text arbitrarily, chunks strictly observe function and class definitions while attaching enclosing context breadcrumbs.
              </p>

              {/* Code Preview Block */}
              <div className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-page)] overflow-hidden font-mono text-xs">
                <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--color-raised)] border-b border-[var(--color-border)] text-[11px] text-[var(--color-muted)]">
                  <span>server/app/services/indexing/ast_chunker.py</span>
                  <span className="text-[var(--color-accent)]">lines 42–52</span>
                </div>
                <div className="p-3 text-[var(--color-text-secondary)] overflow-x-auto leading-relaxed">
                  <div className="text-[var(--color-muted)]"># Preserving class scope in child chunks</div>
                  <div><span className="text-[var(--color-accent)]">def</span> <span className="text-[var(--color-text)]">extract_hierarchical_chunks</span>(tree, source_bytes, file_path):</div>
                  <div className="pl-4">chunks = []</div>
                  <div className="pl-4">scope_stack = []</div>
                  <div className="pl-4"><span className="text-[var(--color-accent)]">for</span> node <span className="text-[var(--color-accent)]">in</span> traverse_ast(tree.root_node):</div>
                  <div className="pl-8">chunk = build_scoped_chunk(node, source_bytes, scope_stack)</div>
                  <div className="pl-8">chunks.append(chunk)</div>
                  <div className="pl-4"><span className="text-[var(--color-accent)]">return</span> chunks</div>
                </div>
              </div>

              {/* Citation Chip */}
              <div className="pt-1 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-[var(--color-muted)]">Citations:</span>
                <button
                  onClick={() => setActiveCitation(!activeCitation)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono transition border ${
                    activeCitation
                      ? 'bg-[var(--color-accent)] text-[var(--color-page)] border-[var(--color-accent)] font-semibold'
                      : 'bg-[var(--color-accent-tint)] text-[var(--color-accent)] border-[var(--color-accent-border)] hover:bg-[var(--color-accent)]/20'
                  }`}
                >
                  <FileCode size={12} />
                  <span>ast_chunker.py:42-88</span>
                </button>
                <span className="text-[11px] text-[var(--color-muted)]">
                  (Click citation to simulate opening Source Panel)
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stepper: How It Works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 border-t border-[var(--color-border)] bg-[var(--color-surface)]/40">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
              Architecture & Pipeline
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)]">
              From git clone to verified answers
            </h2>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] max-w-xl mx-auto">
              Every step is engineered to prevent hallucination by grounding code embeddings directly in concrete syntax trees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
              <div className="h-7 w-7 rounded-lg bg-[var(--color-raised)] flex items-center justify-center text-xs font-bold text-[var(--color-accent)]">
                01
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-text)]">Clone & Ingest</h3>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Connect your repository via GitHub OAuth. Commits are fetched asynchronously and pinned to immutable SHAs.
              </p>
            </div>

            <div className="p-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
              <div className="h-7 w-7 rounded-lg bg-[var(--color-raised)] flex items-center justify-center text-xs font-bold text-[var(--color-accent)]">
                02
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-text)]">Tree-sitter AST</h3>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Source files are parsed into language syntax trees. Classes, methods, and functions form hierarchical symbol graphs.
              </p>
            </div>

            <div className="p-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
              <div className="h-7 w-7 rounded-lg bg-[var(--color-raised)] flex items-center justify-center text-xs font-bold text-[var(--color-accent)]">
                03
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-text)]">pgvector + RRF</h3>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Combines dense vector embeddings with full-text keyword searches using Reciprocal Rank Fusion.
              </p>
            </div>

            <div className="p-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
              <div className="h-7 w-7 rounded-lg bg-[var(--color-raised)] flex items-center justify-center text-xs font-bold text-[var(--color-accent)]">
                04
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-text)]">Exact Citations</h3>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                The Gemini model synthesizes answers while generating verifiable citations linking directly to exact lines in code.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Blocks with SpotlightCard */}
      <section id="features" className="py-20 px-4 sm:px-6 border-t border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
              Engineered For Developers
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)]">
              Precision over guesswork
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SpotlightCard>
              <div className="space-y-3">
                <div className="h-9 w-9 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)]">
                  <Code2 size={18} />
                </div>
                <h3 className="text-base font-semibold text-[var(--color-text)]">
                  Syntax-Aware Chunking
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Never slice a function in half. Tree-sitter guarantees that every chunk aligns with syntactic boundaries and retains enclosing class context.
                </p>
              </div>
            </SpotlightCard>

            <SpotlightCard>
              <div className="space-y-3">
                <div className="h-9 w-9 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)]">
                  <Layers size={18} />
                </div>
                <h3 className="text-base font-semibold text-[var(--color-text)]">
                  Architecture Diagrams
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Generate holistic system architecture diagrams and verified modules derived from actual symbol call-graphs and dependencies.
                </p>
              </div>
            </SpotlightCard>

            <SpotlightCard>
              <div className="space-y-3">
                <div className="h-9 w-9 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)]">
                  <ShieldCheck size={18} />
                </div>
                <h3 className="text-base font-semibold text-[var(--color-text)]">
                  Verifiable Source Panel
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Inspect cited lines side-by-side with your answer. Verify syntax highlighting, symbol definitions, and commit provenance instantly.
                </p>
              </div>
            </SpotlightCard>
          </div>
        </div>
      </section>

      {/* Guarantees Section */}
      <section id="guarantees" className="py-20 px-4 sm:px-6 border-t border-[var(--color-border)] bg-[var(--color-surface)]/30">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)]">
              Grounded by design
            </h2>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] max-w-xl mx-auto">
              Built specifically for engineering teams that cannot tolerate hallucinated APIs or invented signatures.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-page)] space-y-2">
              <CheckCircle2 size={18} className="text-[var(--color-accent)]" />
              <h4 className="text-sm font-semibold text-[var(--color-text)]">No Unreferenced Claims</h4>
              <p className="text-xs text-[var(--color-text-secondary)]">
                If an assertion cannot be mapped to a specific line in the repository, the model explicitly declares it unverified.
              </p>
            </div>

            <div className="p-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-page)] space-y-2">
              <CheckCircle2 size={18} className="text-[var(--color-accent)]" />
              <h4 className="text-sm font-semibold text-[var(--color-text)]">Pinned Git SHAs</h4>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Every conversation records the exact commit hash evaluated, guaranteeing reproducibility even as master evolves.
              </p>
            </div>

            <div className="p-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-page)] space-y-2">
              <CheckCircle2 size={18} className="text-[var(--color-accent)]" />
              <h4 className="text-sm font-semibold text-[var(--color-text)]">Zero Training Retention</h4>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Your private source code and AST chunks are processed securely and never retained to train foundation models.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA with Dither background */}
      <section className="py-24 px-4 sm:px-6 relative border-t border-[var(--color-border)] overflow-hidden">
        <Dither />
        <div className="max-w-3xl mx-auto text-center relative z-10 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--color-text)]">
            Ready to query your codebase with confidence?
          </h2>
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] max-w-lg mx-auto">
            Connect your GitHub account and start interrogating complex codebases in minutes.
          </p>
          <div className="pt-2">
            <Button size="lg" variant="primary" onClick={handleSignIn}>
              <GithubIcon size={16} />
              <span>Get Started with GitHub</span>
              <ArrowRight size={15} />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 border-t border-[var(--color-border)] bg-[var(--color-page)] text-xs text-[var(--color-muted)]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-[var(--color-accent)]" />
            <span>Codebase Intellisense © 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/dashboard')} className="hover:text-[var(--color-text)] transition">
              Dashboard
            </button>
            <button onClick={() => navigate('/status/signing-in')} className="hover:text-[var(--color-text)] transition">
              Sign In
            </button>
            <button onClick={() => navigate('/503')} className="hover:text-[var(--color-text)] transition">
              Status
            </button>
          </div>
        </div>
      </footer>

      {/* Scenario switcher for quick prototype toggling */}
      <ScenarioSwitcher />
    </div>
  );
}
