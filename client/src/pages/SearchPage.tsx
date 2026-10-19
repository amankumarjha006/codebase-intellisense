import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Search as SearchIcon,
  Filter,
  FileCode,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { api } from '../lib/api';
import { Repository, SearchResult, SearchFilters } from '../lib/types';
import { RepositoryHeader } from '../components/repository/RepositoryHeader';
import { RepositoryNavDock } from '../components/repository/RepositoryNavDock';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { AnimatedPage } from '../components/ui/AnimatedPage';
import { LiveRegion } from '../components/ui/A11y';

export function SearchPage() {
  const { id: repoId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [repository, setRepository] = React.useState<Repository | null>(null);
  const [query, setQuery] = React.useState('chunk');
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [filters, setFilters] = React.useState<SearchFilters | null>(null);
  const [selectedExt, setSelectedExt] = React.useState<string | null>(null);
  const [selectedType, setSelectedType] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [copiedPath, setCopiedPath] = React.useState<string | null>(null);
  const [a11yStatus, setA11yStatus] = React.useState('');

  React.useEffect(() => {
    if (!repoId) return;
    api.getRepository(repoId).then(setRepository);
  }, [repoId]);

  const executeSearch = React.useCallback(async (q: string) => {
    if (!repoId) return;
    setLoading(true);
    setA11yStatus(`Searching code for "${q}"...`);
    try {
      const res = await api.searchCode(repoId, q);
      setResults(res.results);
      setFilters(res.filters);
      setA11yStatus(`Found ${res.results.length} code matches for "${q}".`);
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  React.useEffect(() => {
    executeSearch(query);
  }, [executeSearch, query]);

  const handleCopy = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setA11yStatus(`Copied path ${path}`);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  if (!repository) {
    return (
      <div
        role="status"
        aria-label="Loading repository"
        className="p-8 text-center text-xs text-[var(--color-muted)]"
      >
        Loading repository search...
      </div>
    );
  }

  const filteredResults = results.filter((r) => {
    if (selectedExt && !r.file_path.endsWith(selectedExt)) return false;
    if (selectedType && r.symbol_type?.toLowerCase() !== selectedType.toLowerCase()) return false;
    return true;
  });

  return (
    <AnimatedPage className="flex flex-col min-h-full bg-[var(--color-page)]">
      <LiveRegion message={a11yStatus} />
      <RepositoryHeader repository={repository} />

      <main id="main-content" className="p-6 max-w-7xl mx-auto w-full">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="flex-1 min-w-0 space-y-6">
            {/* Search Input Bar */}
            <section role="search" aria-label="Repository code search" className="flex gap-2 max-w-3xl">
          <div className="relative flex-1">
            <SearchIcon size={15} className="absolute left-3 top-3 text-[var(--color-muted)]" aria-hidden="true" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && executeSearch(query)}
              aria-label="Search query"
              placeholder="Search code symbols, identifiers, files, or semantic concepts..."
              className="pl-9 h-11 text-xs sm:text-sm bg-[var(--color-surface)] shadow-sm"
              autoFocus
            />
          </div>
          <Button
            onClick={() => executeSearch(query)}
            className="h-11 px-5"
            aria-label="Execute search"
          >
            Search
          </Button>
        </section>

        {/* Results layout: Filters sidebar + Results list */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Facets Sidebar */}
          {filters && (
            <aside
              aria-label="Search filters and facets"
              className="space-y-5 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-xs"
            >
              <div className="flex items-center gap-1.5 font-semibold text-[var(--color-text)] pb-2 border-b border-[var(--color-border)]">
                <Filter size={13} className="text-[var(--color-accent)]" aria-hidden="true" />
                <span>Filters & Facets</span>
              </div>

              {/* Extensions */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] block mb-2">
                  File Extension
                </label>
                <div className="space-y-1">
                  {filters.extensions.map((ext) => (
                    <button
                      key={ext.ext}
                      onClick={() => setSelectedExt(selectedExt === ext.ext ? null : ext.ext)}
                      aria-pressed={selectedExt === ext.ext}
                      className={`w-full flex items-center justify-between px-2 py-1 rounded text-left transition ${
                        selectedExt === ext.ext
                          ? 'bg-[var(--color-accent-tint)] text-[var(--color-accent)] font-medium'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-raised)]'
                      }`}
                    >
                      <span className="font-mono">{ext.ext}</span>
                      <span className="text-[10px] text-[var(--color-muted)]">{ext.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Symbol Types */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] block mb-2">
                  Symbol Kind
                </label>
                <div className="space-y-1">
                  {filters.symbol_types.map((st) => (
                    <button
                      key={st.type}
                      onClick={() => setSelectedType(selectedType === st.type ? null : st.type)}
                      aria-pressed={selectedType === st.type}
                      className={`w-full flex items-center justify-between px-2 py-1 rounded text-left transition ${
                        selectedType === st.type
                          ? 'bg-[var(--color-accent-tint)] text-[var(--color-accent)] font-medium'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-raised)]'
                      }`}
                    >
                      <span>{st.type}</span>
                      <span className="text-[10px] text-[var(--color-muted)]">{st.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {(selectedExt || selectedType) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedExt(null);
                    setSelectedType(null);
                  }}
                  className="w-full text-xs text-[var(--color-muted)]"
                  aria-label="Clear all facet filters"
                >
                  Clear all filters
                </Button>
              )}
            </aside>
          )}

          {/* Results List */}
          <section aria-label="Search results list" className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between text-xs text-[var(--color-muted)] px-1">
              <span>
                Found <span className="text-[var(--color-text)] font-semibold">{filteredResults.length}</span> code matches for "{query}"
              </span>
              <span className="font-mono text-[11px]">Ranked via Hybrid RRF</span>
            </div>

            {loading ? (
              <div role="status" aria-label="Searching" className="p-12 text-center text-xs text-[var(--color-muted)]">
                Executing hybrid vector & lexical search...
              </div>
            ) : filteredResults.length === 0 ? (
              <div role="status" className="p-12 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] text-center space-y-2">
                <SearchIcon size={24} className="text-[var(--color-muted)] mx-auto" aria-hidden="true" />
                <h4 className="text-sm font-semibold text-[var(--color-text)]">No code matches found</h4>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Try searching for a function name, AST node, or broader keywords.
                </p>
              </div>
            ) : (
              filteredResults.map((result, idx) => (
                <article
                  key={idx}
                  aria-label={`Match in ${result.file_path}`}
                  className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm hover:border-[var(--color-border-strong)] transition"
                >
                  {/* Result Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[var(--color-raised)]/50 border-b border-[var(--color-border)] text-xs">
                    <div className="flex items-center gap-2 font-mono">
                      <FileCode size={14} className="text-[var(--color-accent)] shrink-0" aria-hidden="true" />
                      <span className="font-semibold text-[var(--color-text)]">{result.file_path}</span>
                      <span className="text-[var(--color-muted)]">
                        lines {result.start_line}–{result.end_line}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {result.symbol_type && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--color-raised)] border border-[var(--color-border)] text-[var(--color-text-secondary)]">
                          {result.symbol_type}
                        </span>
                      )}

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleCopy(result.file_path)}
                        title="Copy file path"
                        aria-label={`Copy file path ${result.file_path}`}
                      >
                        {copiedPath === result.file_path ? (
                          <Check size={13} className="text-[var(--color-accent)]" aria-hidden="true" />
                        ) : (
                          <Copy size={13} aria-hidden="true" />
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          navigate(`/repositories/${repoId}/files?path=${encodeURIComponent(result.file_path)}`)
                        }
                        title="Open file viewer"
                        aria-label={`Open file ${result.file_path} in code viewer`}
                      >
                        <ExternalLink size={13} aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  {/* Code snippet */}
                  <div className="p-3 bg-[var(--color-page)] font-mono text-xs overflow-x-auto text-[var(--color-text-secondary)] leading-relaxed">
                    <pre className="whitespace-pre">{result.snippet}</pre>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-2.5 px-3 bg-[var(--color-surface)] border-t border-[var(--color-border)]/60 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-mono text-[var(--color-muted)]">
                      {result.context_function}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/repositories/${repoId}/chat`)}
                      className="h-6 text-[11px] gap-1 text-[var(--color-accent)] hover:text-[var(--color-accent)]"
                      aria-label="Ask about this code in Chat"
                    >
                      <MessageSquare size={11} aria-hidden="true" />
                      <span>Ask about this in Chat</span>
                    </Button>
                  </div>
                </article>
              ))
            )}
          </section>
        </div>
      </div>

      {/* Floating Vertical Navigation Dock (Desktop lg+) */}
      {repository && (
        <aside
          aria-label="Repository navigation dock"
          className="hidden lg:block sticky top-6 shrink-0 z-10"
        >
          <RepositoryNavDock repoId={repository.id} orientation="vertical" />
        </aside>
      )}
    </div>
  </main>
</AnimatedPage>
  );
}
