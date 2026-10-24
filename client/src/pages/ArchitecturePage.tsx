import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { api } from '../lib/api';
import {
  Repository,
  ArchitectureDocument,
  ArchitectureSection,
  Citation,
  ArchitectureGraphNode,
  ArchitectureGraphRelationship,
} from '../lib/types';
import { shortSha, formatRelativeTime, sleep } from '../lib/utils';
import { RepositoryHeader } from '../components/repository/RepositoryHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { SourcePanel } from '../components/chat/SourcePanel';
import { AnimatedPage } from '../components/ui/AnimatedPage';
import { LiveRegion } from '../components/ui/A11y';
import { ArchitectureGraphCanvas } from '../components/architecture/ArchitectureGraphCanvas';
import { ArchitectureDetailsPanel } from '../components/architecture/ArchitectureDetailsPanel';

export function ArchitecturePage() {
  const { id: repoId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [repository, setRepository] = React.useState<Repository | null>(null);
  const [doc, setDoc] = React.useState<ArchitectureDocument | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'graph' | 'spec'>('graph');

  // Graph state
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterScope, setFilterScope] = React.useState<'all' | 'files' | 'pipeline'>('all');
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(true);

  // Technical documentation state
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

  // Derive all graph nodes
  const rawNodes = React.useMemo<ArchitectureGraphNode[]>(() => {
    if (!doc) return [];
    if (doc.graph && doc.graph.nodes && doc.graph.nodes.length > 0) {
      return doc.graph.nodes;
    }
    // Fallback: derive from pipeline diagram
    if (doc.pipeline_diagram && doc.pipeline_diagram.length > 0) {
      return doc.pipeline_diagram.map((p) => ({
        id: p.id,
        name: p.label,
        label: p.label,
        sublabel: p.sublabel,
        type: 'pipeline',
        description: p.sublabel,
      }));
    }
    return [];
  }, [doc]);

  // Derive all graph relationships
  const rawRelationships = React.useMemo<ArchitectureGraphRelationship[]>(() => {
    if (!doc) return [];
    if (doc.graph && doc.graph.relationships && doc.graph.relationships.length > 0) {
      return doc.graph.relationships;
    }
    // Fallback: derive from pipeline diagram connections
    if (doc.pipeline_diagram && doc.pipeline_diagram.length > 0) {
      const rels: ArchitectureGraphRelationship[] = [];
      for (const p of doc.pipeline_diagram) {
        for (const conn of p.connections || []) {
          rels.push({
            source: p.id,
            target: conn,
            type: 'FLOWS_TO',
          });
        }
      }
      return rels;
    }
    return [];
  }, [doc]);

  // Filter nodes according to scope
  const filteredNodes = React.useMemo(() => {
    if (filterScope === 'files') {
      return rawNodes.filter((n) => n.type === 'file');
    }
    if (filterScope === 'pipeline') {
      return rawNodes.filter((n) => n.type === 'pipeline');
    }
    return rawNodes;
  }, [rawNodes, filterScope]);

  const filteredNodeIds = React.useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const filteredRelationships = React.useMemo(() => {
    return rawRelationships.filter(
      (r) => filteredNodeIds.has(r.source) && filteredNodeIds.has(r.target)
    );
  }, [rawRelationships, filteredNodeIds]);

  const selectedNode = React.useMemo(() => {
    if (!selectedNodeId) return null;
    return rawNodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, rawNodes]);

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

  const isEmpty = !doc || (doc.sections.length === 0 && rawNodes.length === 0);

  return (
    <AnimatedPage className="flex flex-col h-full bg-[var(--color-page)] overflow-hidden">
      <LiveRegion message={a11yStatus} />
      <RepositoryHeader repository={repository} />

      {/* Main Architecture Workspace Area */}
      <div className="flex flex-col flex-1 overflow-hidden relative">
        {/* Workspace Toolbar (Area 1) */}
        <header
          aria-label="Architecture workspace controls"
          className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 select-none z-10"
        >
          {/* Left: View Modes & Heading */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 p-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-raised)]/60">
              <button
                onClick={() => setActiveTab('graph')}
                aria-pressed={activeTab === 'graph'}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  activeTab === 'graph'
                    ? 'bg-[var(--color-mint-selected-bg,#253A32)] text-[var(--color-mint-accent,#B9E4D0)] shadow-sm border border-[rgba(185,228,208,0.25)] font-semibold'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                <MaterialIcon
                  name="hub"
                  size={16}
                  fill={activeTab === 'graph' ? 1 : 0}
                  className={activeTab === 'graph' ? 'text-[var(--color-mint-accent,#B9E4D0)]' : ''}
                  aria-hidden="true"
                />
                <span>Interactive Graph</span>
              </button>

              <button
                onClick={() => setActiveTab('spec')}
                aria-pressed={activeTab === 'spec'}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  activeTab === 'spec'
                    ? 'bg-[var(--color-mint-selected-bg,#253A32)] text-[var(--color-mint-accent,#B9E4D0)] shadow-sm border border-[rgba(185,228,208,0.25)] font-semibold'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                <MaterialIcon
                  name="description"
                  size={16}
                  fill={activeTab === 'spec' ? 1 : 0}
                  className={activeTab === 'spec' ? 'text-[var(--color-mint-accent,#B9E4D0)]' : ''}
                  aria-hidden="true"
                />
                <span>Architecture Spec</span>
              </button>
            </div>

            {/* Commit and Freshness Indicator */}
            {doc && (
              <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-[var(--color-muted)]">
                <span className="text-[var(--color-mint-accent,#B9E4D0)] font-semibold">Verified Architecture</span>
                <span aria-hidden="true">•</span>
                <span>Commit {shortSha(doc.sha)}</span>
                <span aria-hidden="true">•</span>
                <span>{formatRelativeTime(doc.generated_at)}</span>
              </div>
            )}
          </div>

          {/* Right: Graph Controls (when in Graph view) */}
          {activeTab === 'graph' && !isEmpty && (
            <div className="flex items-center gap-2">
              {/* Search Filter */}
              <div className="relative w-48 sm:w-64">
                <MaterialIcon
                  name="search"
                  size={16}
                  fill={0}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none"
                  aria-hidden="true"
                />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter module or path..."
                  aria-label="Filter modules or dependencies in graph"
                  className="h-8 pl-8 pr-7 text-xs bg-[var(--color-raised)]/70 border-[var(--color-border)] focus:border-[var(--color-mint-accent,#B9E4D0)] focus:ring-[var(--color-mint-accent,#B9E4D0)]/30"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search query"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-text)] transition p-0.5"
                  >
                    <MaterialIcon name="close" size={14} fill={0} aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* Scope Switcher: All / Files / Pipeline */}
              <div className="hidden sm:flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-raised)]/50 p-0.5 text-[11px] font-mono">
                <button
                  onClick={() => setFilterScope('all')}
                  className={`px-2 py-1 rounded transition ${
                    filterScope === 'all'
                      ? 'bg-[var(--color-page)] text-[var(--color-text)] font-semibold shadow-xs'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterScope('files')}
                  className={`px-2 py-1 rounded transition ${
                    filterScope === 'files'
                      ? 'bg-[var(--color-page)] text-[var(--color-text)] font-semibold shadow-xs'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  Files
                </button>
                <button
                  onClick={() => setFilterScope('pipeline')}
                  className={`px-2 py-1 rounded transition ${
                    filterScope === 'pipeline'
                      ? 'bg-[var(--color-page)] text-[var(--color-text)] font-semibold shadow-xs'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  Pipeline
                </button>
              </div>

              {/* Graph Stats Badge */}
              <Badge variant="outline" className="hidden md:inline-flex text-[11px] font-mono text-[var(--color-muted)] border-[var(--color-border)] bg-[var(--color-raised)]/40 px-2 py-1">
                {filteredNodes.length} nodes • {filteredRelationships.length} edges
              </Badge>

              {/* Re-analyze / Refresh Action */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={loadDoc}
                    aria-label="Refresh architecture graph"
                    className="h-8 w-8 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                  >
                    <MaterialIcon name="refresh" size={16} fill={0} aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Refresh Graph</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Right: Spec Actions (when in Spec view) */}
          {activeTab === 'spec' && !isEmpty && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartGeneration}
                disabled={generating}
                className="h-8 text-xs gap-1.5"
                aria-label="Re-synthesize architecture document"
              >
                <MaterialIcon name="auto_awesome" size={15} fill={0} aria-hidden="true" />
                <span>Re-synthesize</span>
              </Button>
            </div>
          )}
        </header>

        {/* Empty State */}
        {isEmpty && !generating && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="py-20 text-center space-y-5 max-w-lg mx-auto">
              <div
                className="h-14 w-14 rounded-2xl bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-mint-accent,#B9E4D0)] mx-auto"
                aria-hidden="true"
              >
                <MaterialIcon name="account_tree" size={28} fill={1} className="text-[var(--color-mint-accent,#B9E4D0)]" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-[var(--color-text)]">
                  No architecture graph generated
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Analyze {repository.name}'s module imports, call-trees, and execution pipelines to render an interactive architecture explorer.
                </p>
              </div>
              <Button onClick={handleStartGeneration} className="gap-2" aria-label="Synthesize Architecture Graph">
                <MaterialIcon name="hub" size={18} fill={1} aria-hidden="true" />
                <span>Synthesize Architecture Graph</span>
              </Button>
            </div>
          </div>
        )}

        {/* Generating State */}
        {generating && (
          <div className="p-8 max-w-3xl mx-auto my-12 rounded-[var(--radius-panel)] border border-[rgba(251,191,36,0.3)] bg-[var(--color-warning-tint)] space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-warning)]">
                <MaterialIcon name="memory" size={18} fill={1} className="animate-pulse text-[var(--color-warning)]" aria-hidden="true" />
                <span>Synthesizing system architecture from Tree-sitter AST nodes...</span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setGenerating(false)}
                className="h-7 text-xs"
                aria-label="Stop synthesis"
              >
                <MaterialIcon name="stop_circle" size={16} fill={1} aria-hidden="true" />
                <span>Stop</span>
              </Button>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-28 w-full rounded-[var(--radius-panel)]" />
            </div>
          </div>
        )}

        {/* TAB 1: Interactive Architecture Explorer (Canvas + Details Panel) */}
        {!isEmpty && activeTab === 'graph' && (
          <div className="flex flex-1 overflow-hidden relative">
            {/* Main Interactive Canvas (Area 2) */}
            <main
              id="architecture-canvas-area"
              aria-label="Interactive architecture canvas"
              className="flex-1 flex flex-col h-full overflow-hidden relative"
            >
              <ArchitectureGraphCanvas
                nodes={filteredNodes}
                relationships={filteredRelationships}
                selectedNodeId={selectedNodeId}
                searchQuery={searchQuery}
                repoId={repository.id}
                onSelectNode={(id) => {
                  setSelectedNodeId(id);
                  if (id) {
                    setIsDetailsOpen(true);
                    setA11yStatus(`Selected architecture node ${id}`);
                  }
                }}
              />
            </main>

            {/* Details Inspector Panel (Area 3) */}
            <ArchitectureDetailsPanel
              selectedNode={selectedNode}
              allNodes={rawNodes}
              relationships={rawRelationships}
              repoId={repository.id}
              isOpen={isDetailsOpen}
              onToggleOpen={() => setIsDetailsOpen((prev) => !prev)}
              onSelectNode={(id) => {
                setSelectedNodeId(id);
                setA11yStatus(`Selected architecture node ${id}`);
              }}
              onDeselect={() => {
                setSelectedNodeId(null);
                setA11yStatus('Deselected node');
              }}
            />
          </div>
        )}

        {/* TAB 2: Verified Technical Documentation Spec */}
        {!isEmpty && activeTab === 'spec' && (
          <div className="flex flex-1 overflow-hidden relative">
            {/* Table of Contents Outline Sidebar */}
            <nav
              aria-label="Document outline"
              className="w-64 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col shrink-0 overflow-y-auto p-3 no-scrollbar hidden md:block"
            >
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Document Sections
              </div>
              <div className="mt-2 space-y-1">
                {doc?.pipeline_diagram && (
                  <a
                    href="#pipeline-flow-spec"
                    className="block px-2.5 py-1.5 rounded text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)] transition"
                  >
                    Topological Pipeline
                  </a>
                )}
                {doc?.sections.map((sec) => (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    onClick={() => setActiveSectionId(sec.id)}
                    aria-current={activeSectionId === sec.id ? 'true' : undefined}
                    className={`block px-2.5 py-1.5 rounded text-xs transition ${
                      activeSectionId === sec.id
                        ? 'bg-[var(--color-raised)] text-[var(--color-text)] font-semibold border-l-2 border-[var(--color-mint-accent,#B9E4D0)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-raised)]/60 hover:text-[var(--color-text)]'
                    }`}
                  >
                    <span className="font-mono text-[var(--color-muted)] mr-1.5">{sec.number}.</span>
                    <span>{sec.title}</span>
                  </a>
                ))}
              </div>
            </nav>

            {/* Document Content View */}
            <main
              id="spec-content-area"
              aria-label="Architecture specification document"
              className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-4xl mx-auto space-y-10"
            >
              <article className="space-y-10">
                {/* Header */}
                <header className="space-y-2 border-b border-[var(--color-border)] pb-6">
                  <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-muted)]">
                    <span className="text-[var(--color-mint-accent,#B9E4D0)] font-semibold">Verified Architecture Synthesis</span>
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

                {/* Topological Pipeline Section */}
                {doc?.pipeline_diagram && (
                  <section id="pipeline-flow-spec" aria-labelledby="pipeline-spec-heading" className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 id="pipeline-spec-heading" className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                        Topological Data Flow
                      </h2>
                      <button
                        onClick={() => {
                          setFilterScope('pipeline');
                          setActiveTab('graph');
                        }}
                        className="text-xs text-[var(--color-mint-accent,#B9E4D0)] hover:underline flex items-center gap-1 font-mono"
                      >
                        <span>View in Interactive Graph</span>
                        <MaterialIcon name="arrow_forward" size={14} fill={0} aria-hidden="true" />
                      </button>
                    </div>

                    <div className="p-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
                      <div className="flex items-center gap-2 min-w-max py-2">
                        {doc.pipeline_diagram.map((node: { id: string; label: string; sublabel: string }, index: number) => (
                          <React.Fragment key={node.id}>
                            <button
                              onClick={() => {
                                setSelectedNodeId(node.id);
                                setActiveTab('graph');
                              }}
                              className="p-3 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-raised)] hover:border-[var(--color-mint-accent,#B9E4D0)] min-w-[160px] text-left space-y-1 transition group"
                            >
                              <div className="font-semibold text-xs text-[var(--color-text)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition">
                                {node.label}
                              </div>
                              <div className="text-[10px] text-[var(--color-muted)] font-mono leading-tight">
                                {node.sublabel}
                              </div>
                            </button>
                            {index < (doc.pipeline_diagram?.length ?? 0) - 1 && (
                              <MaterialIcon name="arrow_forward" size={16} fill={0} className="text-[var(--color-mint-accent,#B9E4D0)] shrink-0" aria-hidden="true" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {/* Verified Documentation Sections */}
                <div className="space-y-8">
                  {doc?.sections.map((sec: ArchitectureSection) => (
                    <section
                      key={sec.id}
                      id={sec.id}
                      aria-labelledby={`sec-heading-${sec.id}`}
                      className="p-6 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                        <h3 id={`sec-heading-${sec.id}`} className="text-base font-semibold text-[var(--color-text)] flex items-center gap-2">
                          <span className="font-mono text-xs text-[var(--color-mint-accent,#B9E4D0)]">
                            Section {sec.number}
                          </span>
                          <span>{sec.title}</span>
                        </h3>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-[var(--color-mint-selected-bg,#253A32)] text-[var(--color-mint-accent,#B9E4D0)] border border-[rgba(185,228,208,0.22)] font-medium">
                          <MaterialIcon name="check_circle" size={15} fill={1} className="text-[var(--color-mint-accent,#B9E4D0)]" aria-hidden="true" />
                          <span>Verified</span>
                        </div>
                      </div>

                      <div className="prose prose-invert prose-xs max-w-none text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed space-y-2">
                        <Markdown remarkPlugins={[remarkGfm]}>{sec.content || ''}</Markdown>
                      </div>

                      {/* Evidence Citations */}
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
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border border-[rgba(185,228,208,0.3)] bg-[var(--color-mint-selected-bg,#253A32)] text-[var(--color-mint-accent,#B9E4D0)] hover:bg-[var(--color-mint-accent)]/20 transition cursor-pointer"
                            >
                              <MaterialIcon name="description" size={13} fill={1} aria-hidden="true" />
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
            </main>
          </div>
        )}

        {/* Source panel on citation click */}
        {selectedCitation && (
          <SourcePanel
            citation={selectedCitation}
            repoId={repository.id}
            onClose={() => setSelectedCitation(null)}
          />
        )}
      </div>
    </AnimatedPage>
  );
}
