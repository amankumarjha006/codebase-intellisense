'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { LANDING_ERROR_COPY } from '@/lib/errors';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { Hero } from '@/components/landing/Hero';
import { GitCommit, FileCode2, MessagesSquare, Database } from 'lucide-react';
import { Github } from '@/components/icons';
import { MotionConfig, motion } from 'motion/react';
import { variants } from '@/lib/animations';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await api.getCurrentUser();
        router.push('/dashboard');
      } catch (err: unknown) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Session check failed (likely backend unreachable):', err);
        }
      }
    };

    const searchParams = new URLSearchParams(window.location.search);
    const errorParam = searchParams.get('error');
    // Only accept allowlisted error codes; ignore everything else
    if (errorParam && errorParam in LANDING_ERROR_COPY) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(LANDING_ERROR_COPY[errorParam]);
    }

    checkAuth();
  }, [router]);

  const handleLogin = () => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- external backend OAuth redirect
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/github`;
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col bg-background selection:bg-accent/30 selection:text-accent font-sans">
        <LandingHeader onLogin={handleLogin} />

        <main id="main-content" className="flex-1">
          {/* Hero Section */}
          <section className="container max-w-[1200px] mx-auto px-4 sm:px-8 pt-16 pb-24 md:pt-24 md:pb-32">
            <Hero onLogin={handleLogin} error={error} />
          </section>

          {/* How it works Section */}
          <section id="how-it-works" className="border-y border-border bg-surface relative">
            <div className="container max-w-[1200px] mx-auto px-4 sm:px-8">
              <div className="flex flex-col md:flex-row gap-16 lg:gap-24 items-start">
                {/* Sticky Left Column */}
                <div className="md:w-1/3 py-24 md:py-32 md:sticky md:top-14 h-auto">
                  <h2 className="text-[40px] font-medium tracking-tight text-text mb-6">How it works</h2>
                  <p className="text-muted text-lg leading-relaxed">
                    Connect your GitHub repositories, and we parse your codebase using Tree-sitter. We extract symbols, relationships, and context, allowing you to ask natural language questions grounded in your code.
                  </p>
                </div>

                {/* Scrolling Right Column */}
                <div className="md:w-2/3 py-24 md:py-32 relative">
                  <div className="absolute left-[17px] top-[120px] bottom-[120px] w-px bg-border hidden sm:block" />

                  <div className="flex flex-col gap-32 relative z-10 w-full">
                    {/* Step 1 */}
                    <motion.div
                      className="flex gap-6 sm:gap-8 w-full"
                      initial={{ opacity: 0.4 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ margin: "-200px 0px" }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="hidden sm:flex shrink-0 w-9 h-9 mt-1 rounded-lg bg-surface border border-border items-center justify-center text-text shadow-sm relative">
                         <div className="absolute inset-0 rounded-lg ring-4 ring-surface" />
                         <span className="text-[11px] font-medium font-mono text-muted absolute -top-6">01</span>
                         <Github className="w-[18px] h-[18px]" />
                      </div>
                      <div className="flex-1 flex flex-col gap-3">
                        <h3 className="text-xl font-medium text-text">Connect</h3>
                        <p className="text-muted leading-relaxed">
                          Import any public repository directly from GitHub.
                        </p>
                        <div className="mt-2 p-4 rounded-xl border border-border bg-background shadow-sm w-full">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center shrink-0">
                              <Github className="w-4 h-4 text-text" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-text truncate">amankumarjha006/codebase-intellisense</div>
                              <div className="text-xs text-muted">Last active 2h ago</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    {/* Step 2 */}
                    <motion.div
                      className="flex gap-6 sm:gap-8 w-full"
                      initial={{ opacity: 0.4 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ margin: "-200px 0px" }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="hidden sm:flex shrink-0 w-9 h-9 mt-1 rounded-lg bg-surface border border-border items-center justify-center text-text shadow-sm relative">
                         <div className="absolute inset-0 rounded-lg ring-4 ring-surface" />
                         <span className="text-[11px] font-medium font-mono text-muted absolute -top-6">02</span>
                         <Database className="w-[18px] h-[18px]" />
                      </div>
                      <div className="flex-1 flex flex-col gap-3">
                        <h3 className="text-xl font-medium text-text">Index</h3>
                        <p className="text-muted leading-relaxed">
                          We parse ASTs, resolve dependencies, and generate vector embeddings.
                        </p>
                        <div className="mt-2 p-4 rounded-xl border border-accent/30 bg-accent/5 shadow-sm w-full flex items-center justify-between">
                          <div className="text-sm font-medium text-text flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                            Ready
                          </div>
                          <div className="text-xs text-muted font-mono">1,402 files</div>
                        </div>
                      </div>
                    </motion.div>

                    {/* Step 3 */}
                    <motion.div
                      className="flex gap-6 sm:gap-8 w-full"
                      initial={{ opacity: 0.4 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ margin: "-200px 0px" }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="hidden sm:flex shrink-0 w-9 h-9 mt-1 rounded-lg bg-surface border border-border items-center justify-center text-text shadow-sm relative">
                         <div className="absolute inset-0 rounded-lg ring-4 ring-surface" />
                         <span className="text-[11px] font-medium font-mono text-muted absolute -top-6">03</span>
                         <MessagesSquare className="w-[18px] h-[18px]" />
                      </div>
                      <div className="flex-1 flex flex-col gap-3">
                        <h3 className="text-xl font-medium text-text">Ask</h3>
                        <p className="text-muted leading-relaxed">
                          Chat with your codebase. Get answers with exact file and line citations.
                        </p>
                        <div className="mt-2 p-4 rounded-xl border border-border bg-background shadow-sm w-full">
                          <div className="flex items-center gap-2 text-sm text-text">
                            <div className="w-6 h-6 rounded-md bg-raised border border-border flex items-center justify-center text-[10px] shrink-0">
                              U
                            </div>
                            <span className="truncate">Where is the auth middleware?</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Grounded by design Section */}
          <section className="container max-w-[1200px] mx-auto px-4 sm:px-8 py-24 md:py-32">
            <motion.div
              className="max-w-2xl mb-16"
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: "-80px" }}
              variants={variants.fadeUp}
            >
              <h2 className="text-[40px] font-medium tracking-tight text-text mb-6">Grounded by design</h2>
              <p className="text-muted text-lg leading-relaxed">
                A wrong answer about your code is worse than no answer. Our entire pipeline is built to enforce strict provenance.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Block 1 */}
              <motion.div
                className="lg:col-span-2 rounded-2xl border border-border bg-surface p-8 flex flex-col justify-between overflow-hidden relative min-h-[300px]"
                initial="initial"
                whileInView="animate"
                viewport={{ once: true, margin: "-80px" }}
                variants={variants.fadeUp}
                custom={0}
              >
                <div className="z-10 max-w-md">
                  <h3 className="text-xl font-medium text-text mb-2">Citations on every answer</h3>
                  <p className="text-muted">
                    Every answer shows the code it was drawn from. Click any citation to see exactly which files and lines an answer used.
                  </p>
                </div>
                <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4">
                  <div className="p-4 bg-background rounded-tl-2xl border-t border-l border-border shadow-2xl">
                    <button className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent-soft text-accent font-mono text-sm border border-accent-border pointer-events-none shadow-none">
                      <FileCode2 className="w-4 h-4" />
                      src/auth/middleware.ts:42
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Block 2 */}
              <motion.div
                className="rounded-2xl border border-border bg-surface p-8 flex flex-col gap-4"
                initial="initial"
                whileInView="animate"
                viewport={{ once: true, margin: "-80px" }}
                variants={variants.fadeUp}
                transition={{ delay: 0.06 }}
              >
                <div className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center mb-1">
                  <GitCommit className="w-[18px] h-[18px] text-text" />
                </div>
                <h3 className="text-xl font-medium text-text">Pinned to history</h3>
                <p className="text-muted">
                  Every conversation is pinned to a specific commit SHA. Your answers won&apos;t mysteriously change because someone pushed to main.
                </p>
                <div className="mt-auto pt-6">
                  <div className="inline-flex items-center gap-2 text-xs font-mono text-muted bg-background px-2.5 py-1.5 rounded-md border border-border">
                    <GitCommit className="w-3.5 h-3.5" />
                    7a3b8c9
                  </div>
                </div>
              </motion.div>

              {/* Block 3 */}
              <motion.div
                className="lg:col-span-3 rounded-2xl border border-border bg-surface p-8 flex flex-col md:flex-row items-center gap-12"
                initial="initial"
                whileInView="animate"
                viewport={{ once: true, margin: "-80px" }}
                variants={variants.fadeUp}
                transition={{ delay: 0.12 }}
              >
                <div className="flex-1">
                  <h3 className="text-xl font-medium text-text mb-2">Streamed, fast responses</h3>
                  <p className="text-muted max-w-lg">
                    Codebase Intellisense streams the answer directly to you as it&apos;s generated, maintaining a fast and responsive feeling even on massive repositories.
                  </p>
                </div>
                <div className="flex-1 w-full">
                  <div className="p-4 bg-background rounded-xl border border-border space-y-3 shadow-inner">
                    <div className="h-4 w-3/4 bg-raised rounded animate-pulse" />
                    <div className="h-4 w-full bg-raised rounded animate-pulse" />
                    <div className="h-4 w-5/6 bg-raised rounded animate-pulse" />
                    <div className="flex gap-2 pt-2">
                       <div className="h-6 w-24 bg-accent/20 rounded border border-accent/30 animate-pulse" />
                       <div className="h-6 w-32 bg-accent/20 rounded border border-accent/30 animate-pulse" />
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="border-t border-border bg-surface py-24 md:py-32 relative overflow-hidden group">
            <motion.div
              className="absolute inset-0 bg-gradient-to-tr from-accent/0 via-accent/[0.03] to-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"
              initial={{ backgroundPosition: "0% 0%" }}
              animate={{ backgroundPosition: ["0% 0%", "100% 100%"] }}
              transition={{ repeat: Infinity, duration: 20, ease: "linear", repeatType: "reverse" }}
              style={{ backgroundSize: "200% 200%" }}
            />
            <div className="container max-w-4xl mx-auto px-4 sm:px-8 text-center relative z-10">
              <h2 className="text-[40px] md:text-5xl font-medium tracking-tight text-text mb-6">
                Understand your codebase.
              </h2>
              <p className="text-muted text-lg md:text-xl max-w-2xl mx-auto mb-10">
                Stop grep-ing through legacy code. Get instant, accurate, and cited answers about your entire repository.
              </p>
              <button
                onClick={handleLogin}
                className="px-8 py-4 rounded-xl bg-accent text-[#0F0F0E] font-medium text-lg transition-colors duration-150 hover:bg-accent-text inline-flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:ring-accent shadow-none"
              >
                <Github className="w-6 h-6" />
                Start for free with GitHub
              </button>
            </div>
          </section>
        </main>
        
        <footer className="border-t border-border bg-background py-8">
          <div className="container max-w-[1200px] mx-auto px-4 sm:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted">
              © {new Date().getFullYear()} Codebase Intellisense
            </div>
            <Link
              href="https://github.com/amankumarjha006/codebase-intellisense"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-muted hover:text-text transition-colors flex items-center gap-2"
            >
              <Github className="w-4 h-4" />
              Source Code
            </Link>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
