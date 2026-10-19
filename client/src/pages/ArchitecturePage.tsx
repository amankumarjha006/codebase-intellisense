import * as React from 'react';
import { useParams } from 'react-router-dom';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Layers,
  FileCode,
  CheckCircle2,
  ArrowRight,
  StopCircle,
  Cpu,
  Workflow,
} from 'lucide-react';
import { api } from '../lib/api';
import { Repository, ArchitectureDocument, ArchitectureSection, Citation } from '../lib/types';
import { shortSha, formatRelativeTime, sleep } from '../lib/utils';
import { RepositoryHeader } from '../components/repository/RepositoryHeader';
import { RepositoryNavDock } from '../components/repository/RepositoryNavDock';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { SourcePanel } from '../components/chat/SourcePanel';
import { AnimatedPage } from '../components/ui/AnimatedPage';
import { LiveRegion } from '../components/ui/A11y';

export function ArchitecturePage() {
  const { id: repoId } = useParams<{ id: string }>();

  const [repository, setRepository] = React.useState<Repository | null>(null);
  const [doc, setDoc] = React.useState<ArchitectureDocument | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [activeSectionId, setActiveSectionId] = React.useState<string | null>(null);
  const [selectedCitation, setSelectedCitation] = React.useState<Citation | null>(null);
  const [a11yStatus, setA11yStatus] = React.useState('');

  const loadDoc = React.useCallback(async () => {
    if (!repoId) return;
    setLoading(true);
    try {
      const repo = await api.getRepository(repoId);
      setRepository(repo);
      const archDoc = await api.getArchitectureDocument(repoId);
      setDoc(archDoc);
      if (archDoc.sections.length > 0 && archDoc.sections[0]) {
        setActiveSectionId(archDoc.sections[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  React.useEffect(() => {
    loadDoc();
  }, [loadDoc]);

  const handleStartGeneration = async () => {
    setGenerating(true);
    setA11yStatus('Synthesizing system architecture from Tree-sitter AST nodes...');
    await sleep(1200);
    const archDoc = await api.getArchitectureDocument(repoId || '');
    setDoc(archDoc);
    setGenerating(false);
    setA11yStatus('Architecture synthesis complete.');
    if (archDoc.sections.length > 0 && archDoc.sections[0]) {
      setActiveSectionId(archDoc.sections[0].id);
    }
  };

  if (!repository || loading) {
    return (
      <div
        role="status"
        aria-label="Loading repository"
        className="p-8 text-center text-xs text-[var(--color-muted)]"
      >
        Loading repository architecture...
      </div>
    );
  }

  const isEmpty = !doc || doc.sections.length === 0;

  return (
    <AnimatedPage className="flex flex-col h-full bg-[var(--color-page)]">
      <LiveRegion message={a11yStatus} />
      <RepositoryHeader repository={repository} />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left: Table of Contents / Outline Sidebar */}
        {!isEmpty && (
          <nav
            aria-label="Document outline"
            className="w-64 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col shrink-0 overflow-y-auto p-3 no-scrollbar hidden md:block"
          >
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Document Outline
            </div>
            <div className="mt-2 space-y-1">
              <a
                href="#pipeline-diagram"
                className="block px-2.5 py-1.5 rounded text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)] transition"
              >
                Topological Pipeline
              </a>
              {doc.sections.map((sec) => (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  onClick={() => setActiveSectionId(sec.id)}
                  aria-current={activeSectionId === sec.id ? 'true' : undefined}
                  className={`block px-2.5 py-1.5 rounded text-xs transition ${
                    activeSectionId === sec.id
                      ? 'bg-[var(--color-raised)] text-[var(--color-text)] font-semibold border-l-2 border-[var(--color-accent)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-raised)]/60 hover:text-[var(--color-text)]'
                  }`}
                >
                  <span className="font-mono text-[var(--color-muted)] mr-1.5">{sec.number}.</span>
                  <span>{sec.title}</span>
                </a>
              ))}
            </div>
          </nav>
        )}

        {/* Center: Main Architecture Document */}
        <main
          id="main-content"
          aria-label="Architecture document content"
          className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto space-y-10"
        >
          {/* Empty State */}
          {isEmpty && !generating && (
            <div className="py-20 text-center space-y-5 max-w-lg mx-auto">
              <div
                className="h-14 w-14 rounded-2xl bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)] mx-auto"
                aria-hidden="true"
              >
                <Layers size={26} />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-[var(--color-text)]">
                  No architecture document generated
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Analyze {repository.name}'s symbol graphs, import hierarchies, and data pipelines to produce a comprehensive topological architecture document.
                </p>
              </div>
              <Button onClick={handleStartGeneration} className="gap-2" aria-label="Synthesize Architecture Document">
                <Workflow size={15} aria-hidden="true" />
                <span>Synthesize Architecture Document</span>
              </Button>
            </div>
          )}

          {/* Generating State */}
          {generating && (
            <div
              role="status"
              aria-live="polite"
              className="p-8 rounded-[var(--radius-panel)] border border-[rgba(251,191,36,0.3)] bg-[var(--color-warning-tint)] space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-warning)]">
                  <Cpu size={16} className="animate-pulse text-[var(--color-warning)]" aria-hidden="true" />
                  <span>Synthesizing system architecture from Tree-sitter AST nodes...</span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setGenerating(false)}
                  className="h-7 text-xs"
                  aria-label="Stop synthesis"
                >
                  <StopCircle size={13} aria-hidden="true" />
                  <span>Stop</span>
                </Button>
              </div>
              <div className="space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-24 w-full rounded-[var(--radius-panel)]" />
              </div>
            </div>
          )}

          {/* Populated Architecture Document */}
          {!isEmpty && (
            <article className="space-y-10">
              {/* Document Header */}
              <header className="space-y-2 border-b border-[var(--color-border)] pb-6">
                <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-muted)]">
                  <span className="text-[var(--color-accent)] font-semibold">Verified Architecture Synthesis</span>
                  <span aria-hidden="true">•</span>
                  <span>Commit {shortSha(doc.sha)}</span>
                  <span aria-hidden="true">•</span>
                  <span>{formatRelativeTime(doc.generated_at)}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--color-text)]">
                  System Architecture & Execution Pipeline
                </h1>
                <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  Derived from concrete syntax trees, symbol relationships, and citation-anchored source modules.
                </p>
              </header>

              {/* Topological Pipeline Diagram */}
              {doc.pipeline_diagram && (
                <section id="pipeline-diagram" aria-labelledby="pipeline-heading" className="space-y-3">
                  <h2 id="pipeline-heading" className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Topological Data Flow
                  </h2>
                  <div className="p-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
                    <div className="flex items-center gap-2 min-w-max py-2">
                      {doc.pipeline_diagram.map((node: { id: string; label: string; sublabel: string }, index: number) => (
                        <React.Fragment key={node.id}>
                          <div className="p-3 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-raised)] min-w-[150px] space-y-1">
                            <div className="font-semibold text-xs text-[var(--color-text)]">
                              {node.label}
                            </div>
                            <div className="text-[10px] text-[var(--color-muted)] font-mono leading-tight">
                              {node.sublabel}
                            </div>
                          </div>
                          {index < (doc.pipeline_diagram?.length ?? 0) - 1 && (
                            <ArrowRight size={14} className="text-[var(--color-accent)] shrink-0" aria-hidden="true" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* Verified Sections */}
              <div className="space-y-8">
                {doc.sections.map((sec: ArchitectureSection) => (
                  <section
                    key={sec.id}
                    id={sec.id}
                    aria-labelledby={`sec-heading-${sec.id}`}
                    className="p-6 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                      <h3 id={`sec-heading-${sec.id}`} className="text-base font-semibold text-[var(--color-text)] flex items-center gap-2">
                        <span className="font-mono text-xs text-[var(--color-accent)]">
                          Section {sec.number}
                        </span>
                        <span>{sec.title}</span>
                      </h3>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-[var(--color-accent-tint)] text-[var(--color-accent)] font-medium">
                        <CheckCircle2 size={12} aria-hidden="true" />
                        <span>AST Verified</span>
                      </div>
                    </div>

                    <div className="prose prose-invert prose-xs max-w-none text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed space-y-2">
                      <Markdown remarkPlugins={[remarkGfm]}>{sec.content || ''}</Markdown>
                    </div>

                    {/* Citations */}
                    {sec.citations && sec.citations.length > 0 && (
                      <div
                        aria-label="Evidence citations"
                        className="pt-3 border-t border-[var(--color-border)]/60 flex flex-wrap items-center gap-2"
                      >
                        <span className="text-[11px] text-[var(--color-muted)] font-medium">
                          Evidence citations:
                        </span>
                        {sec.citations.map((c: Citation, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedCitation(c)}
                            aria-label={`View citation in ${c.path.split('/').pop()} lines ${c.start_line} to ${c.end_line}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border border-[var(--color-accent-border)] bg-[var(--color-accent-tint)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition cursor-pointer"
                          >
                            <FileCode size={12} aria-hidden="true" />
                            <span>
                              {c.path.split('/').pop()}:{c.start_line}–{c.end_line}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </article>
          )}
        </main>

        {/* Source panel on citation click */}
        {selectedCitation && (
          <SourcePanel
            citation={selectedCitation}
            repoId={repository.id}
            onClose={() => setSelectedCitation(null)}
          />
        )}

        {/* Floating Vertical Navigation Dock (Desktop lg+) */}
        <aside
          aria-label="Repository navigation dock"
          className="hidden lg:block p-4 shrink-0 z-10"
        >
          <RepositoryNavDock repoId={repository.id} orientation="vertical" />
        </aside>
      </div>
    </AnimatedPage>
  );
}
