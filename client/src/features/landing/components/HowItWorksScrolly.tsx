import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { TiltedCard } from './TiltedCard';
import proofData from '../data/proof.json';
import archData from '../data/architecture.json';

interface Chapter {
  id: string;
  number: string;
  title: string;
  summary: string;
  details: string[];
}

const CHAPTERS: Chapter[] = [
  {
    id: 'connect',
    number: '01',
    title: 'Connect any public repository',
    summary:
      'Link any public GitHub repository with a single click. We request read-only email scope without write access, repo admin privileges, or webhook installation.',
    details: [
      'Read-only OAuth scope (user:email only)',
      'Direct clone into isolated, ephemeral memory sandbox',
      'Pinned strictly to immutable commit SHA snapshot',
    ],
  },
  {
    id: 'index',
    number: '02',
    title: 'Parse AST symbols and vector embeddings',
    summary:
      'Tree-sitter extracts function signatures, class hierarchies, and type definitions into structured symbols. Chunks are embedded with line-level boundaries into pgvector.',
    details: [
      `${proofData.sourceFilesAnalyzed.toLocaleString()} source files parsed (${proofData.pythonFiles} Python, ${proofData.javascriptFiles} JS)`,
      `${proofData.symbolsExtracted.toLocaleString()} AST symbols indexed with precise start/end lines`,
      `${proofData.internalImportsResolvedPercent}% internal import resolution rate`,
    ],
  },
  {
    id: 'ask',
    number: '03',
    title: 'Ask in natural language, retrieve with hybrid search',
    summary:
      'Queries run through a two-stage hybrid retrieval pipeline combining dense vector similarity with exact AST symbol and path lookups to filter out irrelevant files.',
    details: [
      'Dense vector similarity via bge-base-en-v1.5 (768 dimensions)',
      'Exact AST symbol match and lexical path filtering',
      'Zero synthetic hallucination: every claim citations exact line numbers',
    ],
  },
  {
    id: 'map',
    number: '04',
    title: 'Visualize directory architecture and relationships',
    summary:
      'Codebase Intellisense maps directory modules, entrypoints, and cross-module import weights, giving you an immediate structural mental model of any unfamiliar codebase.',
    details: [
      'Automated architectural module discovery and layering',
      'Cross-component import call graph with weighted dependency counts',
      'Disclosed as static directory analysis pinned to the indexed commit',
    ],
  },
];

export const HowItWorksScrolly: React.FC = () => {
  const [activeChapter, setActiveChapter] = useState(0);
  const chapterRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const handleScroll = () => {
      const viewportCenter = window.innerHeight / 2;
      let closestIdx = 0;
      let minDistance = Infinity;

      chapterRefs.current.forEach((el, idx) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const elementCenter = rect.top + rect.height / 2;
        const distance = Math.abs(elementCenter - viewportCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestIdx = idx;
        }
      });

      setActiveChapter(closestIdx);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section id="how-it-works" className="relative py-24 md:py-36 border-t border-[var(--landing-hairline)]">
      <div className="max-w-[1280px] mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section Header */}
        <div className="max-w-2xl mb-16 md:mb-24">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-[var(--landing-surface-dim)] border border-[var(--landing-hairline)] text-xs font-mono text-[var(--landing-ink-secondary)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--landing-accent)]" />
            ENGINEERING PIPELINE
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal text-[var(--landing-ink)] tracking-tight font-display mb-4">
            How Codebase Intellisense works
          </h2>
          <p className="text-base sm:text-lg text-[var(--landing-ink-secondary)] leading-relaxed">
            From raw Git commits to verifiable answers. A four-stage pipeline designed for precision, verifiable line-level citations, and zero fabrication.
          </p>
        </div>

        {/* Scrollytelling Grid: Left Chapters, Right Sticky Scene */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-12 items-start">
          {/* Left Column: Chapters */}
          <div className="lg:col-span-5 space-y-16 lg:space-y-36">
            {CHAPTERS.map((chapter, idx) => {
              const isActive = activeChapter === idx;
              return (
                <div
                  key={chapter.id}
                  ref={(el) => {
                    chapterRefs.current[idx] = el;
                  }}
                  className={`transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-40 lg:opacity-40'}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className={`text-sm font-mono px-2.5 py-0.5 rounded transition-colors ${
                        isActive
                          ? 'bg-[var(--landing-accent)] text-[var(--landing-ink)] font-semibold'
                          : 'bg-[var(--landing-surface-dim)] text-[var(--landing-ink-tertiary)]'
                      }`}
                    >
                      {chapter.number}
                    </span>
                    <span className="text-xs font-mono uppercase tracking-wider text-[var(--landing-ink-tertiary)]">
                      Stage {idx + 1} of {CHAPTERS.length}
                    </span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-display font-medium text-[var(--landing-ink)] mb-4 tracking-tight">
                    {chapter.title}
                  </h3>

                  <p className="text-base text-[var(--landing-ink-secondary)] leading-relaxed mb-6">
                    {chapter.summary}
                  </p>

                  <ul className="space-y-2.5">
                    {chapter.details.map((detail, dIdx) => (
                      <li key={dIdx} className="flex items-start gap-2.5 text-sm text-[var(--landing-ink)]">
                        <svg
                          className="w-4 h-4 text-[var(--landing-accent)] shrink-0 mt-0.5"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>

                  {/* On Mobile: Render scene inline directly under the chapter */}
                  <div className="block lg:hidden mt-8">
                    <SceneCard activeIndex={idx} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Sticky Morphing Cockpit Scene (Desktop Only) */}
          <div className="hidden lg:block lg:col-span-7 sticky top-28 self-start">
            <div className="p-1 rounded-2xl bg-[var(--panel-bg)] border border-[var(--panel-border)] shadow-2xl overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeChapter}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: -12, scale: 0.98 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  <SceneCard activeIndex={activeChapter} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/* Cockpit Scene Dispatcher */
const SceneCard: React.FC<{ activeIndex: number }> = ({ activeIndex }) => {
  switch (activeIndex) {
    case 0:
      return <ConnectScene />;
    case 1:
      return <IndexScene />;
    case 2:
      return <AskScene />;
    case 3:
      return <MapScene />;
    default:
      return <ConnectScene />;
  }
};

/* Chapter 1 Scene: Connect */
const ConnectScene: React.FC = () => {
  return (
    <div className="p-6 sm:p-8 bg-[var(--panel-surface)] rounded-xl text-[var(--panel-text)] min-h-[460px] flex flex-col justify-between">
      <div>
        {/* Window Chrome */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-[var(--panel-border)]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
            <span className="ml-2 text-xs font-mono text-[var(--panel-text-secondary)]">git-handshake · public auth</span>
          </div>
          <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Connected
          </span>
        </div>

        {/* Repository Intake Card */}
        <div className="p-5 rounded-lg bg-[var(--panel-raised)] border border-[var(--panel-border)] mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"
                  />
                </svg>
              </div>
              <div>
                <div className="font-mono text-sm font-semibold text-white">fastapi/fastapi</div>
                <div className="text-xs text-[var(--panel-text-secondary)] font-mono">
                  Branch: master · Commit: {proofData.shortCommit}
                </div>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--landing-accent-tint)] text-[var(--landing-accent)] border border-[var(--landing-accent-border)]">
              Public Repo
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono mt-4 pt-4 border-t border-[var(--panel-border)]">
            <div>
              <span className="text-[var(--panel-text-secondary)] block">OAuth Scope:</span>
              <span className="text-white font-medium">user:email (read-only)</span>
            </div>
            <div>
              <span className="text-[var(--panel-text-secondary)] block">Write Access:</span>
              <span className="text-amber-400 font-medium">None requested</span>
            </div>
          </div>
        </div>

        {/* Security / Verification Checklist */}
        <div className="space-y-3 font-mono text-xs">
          <div className="flex items-center gap-3 p-3 rounded bg-black/30 border border-white/5">
            <span className="text-emerald-400">✓</span>
            <span className="text-[var(--panel-text-secondary)]">Token encrypted at rest via AES before storage</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded bg-black/30 border border-white/5">
            <span className="text-emerald-400">✓</span>
            <span className="text-[var(--panel-text-secondary)]">Zero webhooks or repository modification rights</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded bg-black/30 border border-white/5">
            <span className="text-emerald-400">✓</span>
            <span className="text-[var(--panel-text-secondary)]">Queries pinned strictly to commit {proofData.shortCommit}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-[var(--panel-border)] flex items-center justify-between text-xs font-mono text-[var(--panel-text-secondary)]">
        <span>Repo size: 1,465 total files</span>
        <span className="text-[var(--landing-accent)]">Snapshot verified</span>
      </div>
    </div>
  );
};

/* Chapter 2 Scene: Index */
const IndexScene: React.FC = () => {
  return (
    <div className="p-6 sm:p-8 bg-[var(--panel-surface)] rounded-xl text-[var(--panel-text)] min-h-[460px] flex flex-col justify-between">
      <div>
        {/* Window Chrome */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-[var(--panel-border)]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
            <span className="ml-2 text-xs font-mono text-[var(--panel-text-secondary)]">tree-sitter · ast indexing</span>
          </div>
          <span className="text-xs font-mono text-[var(--landing-accent)]">100% Parsed</span>
        </div>

        {/* Counter Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--panel-border)]">
            <div className="text-xl sm:text-2xl font-mono font-medium text-white">
              {proofData.sourceFilesAnalyzed.toLocaleString()}
            </div>
            <div className="text-[11px] font-mono text-[var(--panel-text-secondary)] mt-1">Source Files</div>
          </div>
          <div className="p-3.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--panel-border)]">
            <div className="text-xl sm:text-2xl font-mono font-medium text-[var(--landing-accent)]">
              {proofData.symbolsExtracted.toLocaleString()}
            </div>
            <div className="text-[11px] font-mono text-[var(--panel-text-secondary)] mt-1">AST Symbols</div>
          </div>
          <div className="p-3.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--panel-border)]">
            <div className="text-xl sm:text-2xl font-mono font-medium text-emerald-400">
              {proofData.internalImportsResolvedPercent}%
            </div>
            <div className="text-[11px] font-mono text-[var(--panel-text-secondary)] mt-1">Imports Resolved</div>
          </div>
        </div>

        {/* Live File Tree Extraction Log */}
        <div className="p-4 rounded-lg bg-black/40 border border-white/5 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-white/5 text-[var(--panel-text-secondary)]">
            <span>Symbol Indexing Feed</span>
            <span>Target AST Span</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-2">
                <span className="text-amber-400">class</span>
                <span className="text-white font-medium">FastAPI</span>
              </span>
              <span className="text-[var(--panel-text-secondary)]">fastapi/applications.py:52-254</span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-2">
                <span className="text-purple-400">def</span>
                <span className="text-white font-medium">Depends()</span>
              </span>
              <span className="text-[var(--panel-text-secondary)]">fastapi/params.py:65-115</span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-2">
                <span className="text-purple-400">def</span>
                <span className="text-white font-medium">get_openapi()</span>
              </span>
              <span className="text-[var(--panel-text-secondary)]">fastapi/openapi/utils.py:258-378</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-[var(--panel-border)] flex items-center justify-between text-xs font-mono text-[var(--panel-text-secondary)]">
        <span>Embeddings: BAAI/bge-base-en-v1.5</span>
        <span className="text-emerald-400">pgvector ready</span>
      </div>
    </div>
  );
};

/* Chapter 3 Scene: Ask */
const AskScene: React.FC = () => {
  return (
    <div className="p-6 sm:p-8 bg-[var(--panel-surface)] rounded-xl text-[var(--panel-text)] min-h-[460px] flex flex-col justify-between">
      <div>
        {/* Window Chrome */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-[var(--panel-border)]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
            <span className="ml-2 text-xs font-mono text-[var(--panel-text-secondary)]">hybrid-retrieval · rag pipeline</span>
          </div>
          <span className="text-xs font-mono text-[var(--landing-accent)]">Grounded Synthesis</span>
        </div>

        {/* User Query Pill */}
        <div className="p-4 rounded-lg bg-[var(--panel-raised)] border border-[var(--panel-border)] mb-5">
          <div className="text-[11px] font-mono uppercase text-[var(--panel-text-secondary)] mb-1.5">User Query</div>
          <div className="font-mono text-sm text-white font-medium">
            &quot;How does FastAPI generate the OpenAPI schema from route definitions and parameters?&quot;
          </div>
        </div>

        {/* Two-Stage Retrieval Waterfall */}
        <div className="space-y-3 font-mono text-xs">
          <div className="p-3.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[var(--landing-accent-tint)] text-[var(--landing-accent)] flex items-center justify-center font-bold text-[10px]">
                1
              </span>
              <div>
                <div className="text-white font-medium">Dense Vector Retrieval</div>
                <div className="text-[11px] text-[var(--panel-text-secondary)]">Cosine search in 768-dim embedding space</div>
              </div>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded bg-white/5 text-[var(--panel-text-secondary)]">Top 12 chunks</span>
          </div>

          <div className="p-3.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[10px]">
                2
              </span>
              <div>
                <div className="text-white font-medium">AST Symbol & Path Reranking</div>
                <div className="text-[11px] text-[var(--panel-text-secondary)]">Exact match on symbol: get_openapi</div>
              </div>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">Confidence: 0.94</span>
          </div>
        </div>

        {/* Citation Output Box */}
        <div className="mt-4 p-3.5 rounded-lg bg-[var(--landing-accent-tint)] border border-[var(--landing-accent-border)] flex items-center justify-between font-mono text-xs">
          <div className="flex items-center gap-2 text-white">
            <span className="text-[var(--landing-accent)]">✓</span>
            <span>Synthesizing with verified citations:</span>
          </div>
          <span className="text-[var(--landing-accent)] font-semibold">fastapi/openapi/utils.py:258-378</span>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-[var(--panel-border)] flex items-center justify-between text-xs font-mono text-[var(--panel-text-secondary)]">
        <span>Prompt context: exact chunks only</span>
        <span className="text-emerald-400">Zero synthetic claims</span>
      </div>
    </div>
  );
};

/* Chapter 4 Scene: Map with 3D Tilt */
const MapScene: React.FC = () => {
  return (
    <TiltedCard maxAngle={8}>
      <div className="p-6 sm:p-8 bg-[var(--panel-surface)] rounded-xl text-[var(--panel-text)] min-h-[460px] flex flex-col justify-between">
        <div>
          {/* Window Chrome */}
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-[var(--panel-border)]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
              <span className="ml-2 text-xs font-mono text-[var(--panel-text-secondary)]">
                architecture-map · {archData.repo} @ {archData.commit}
              </span>
            </div>
            <span className="text-xs font-mono text-[var(--landing-accent)]">Static Call Graph</span>
          </div>

          {/* Interactive Graph Representation */}
          <div className="relative p-5 rounded-lg bg-black/50 border border-white/5 mb-5">
            <div className="text-[11px] font-mono text-[var(--panel-text-secondary)] mb-4 flex items-center justify-between">
              <span>CORE ARCHITECTURAL MODULES</span>
              <span className="text-[var(--landing-accent)]">Pointer 3D Tilt</span>
            </div>

            {/* Core Modules Grid */}
            <div className="grid grid-cols-2 gap-3 font-mono text-xs mb-4">
              {archData.components.map((comp) => {
                const isCore = comp.name === 'fastapi';
                return (
                  <div
                    key={comp.id}
                    className={`p-3 rounded-lg border transition-all ${
                      isCore
                        ? 'bg-[var(--landing-accent-tint)] border-[var(--landing-accent-border)] text-white'
                        : 'bg-[var(--panel-raised)] border-white/5 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">{comp.name}</span>
                      <span className="text-[10px] text-[var(--panel-text-secondary)]">
                        {comp.file_count} files
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--panel-text-secondary)] truncate">
                      {comp.summary}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Real Dependencies Callouts */}
            <div className="p-3 rounded bg-white/5 border border-white/5 font-mono text-xs space-y-1.5">
              <div className="text-[10px] text-[var(--panel-text-secondary)] uppercase">Verified Call Graph Weights:</div>
              <div className="flex items-center justify-between text-slate-200 text-[11px]">
                <span>tests → fastapi</span>
                <span className="text-[var(--landing-accent)] font-semibold">895 internal imports</span>
              </div>
              <div className="flex items-center justify-between text-slate-200 text-[11px]">
                <span>docs_src → fastapi</span>
                <span className="text-[var(--landing-accent)] font-semibold">527 internal imports</span>
              </div>
            </div>
          </div>

          {/* External Dependencies Tags */}
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
            <span className="text-[11px] text-[var(--panel-text-secondary)] mr-1">External:</span>
            {archData.externalDependencies.slice(0, 5).map((dep) => (
              <span
                key={dep}
                className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-slate-300"
              >
                {dep}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-[var(--panel-border)] flex items-center justify-between text-xs font-mono text-[var(--panel-text-secondary)]">
          <span>Static directory & import analysis</span>
          <span className="text-amber-400">Read-only mental model</span>
        </div>
      </div>
    </TiltedCard>
  );
};
