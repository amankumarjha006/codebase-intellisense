import * as React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { realApi, api, getCachedRepository, type SearchResultItem } from '../lib/api';
import type { Repository } from '../lib/types';
import { RepositoryHeader } from '../components/repository/RepositoryHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { AnimatedPage } from '../components/ui/AnimatedPage';
import { LiveRegion } from '../components/ui/A11y';
import { SearchCodePreview } from '../components/search/SearchCodePreview';

export function SearchPage() {
  const { id: repoId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlQuery = searchParams.get('q') || '';
  const [repository, setRepository] = React.useState<Repository | null>(() =>
    repoId ? getCachedRepository(repoId) : null
  );
  const [query, setQuery] = React.useState(urlQuery);
  const [results, setResults] = React.useState<SearchResultItem[]>([]);
  const [selectedResult, setSelectedResult] = React.useState<SearchResultItem | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(!!urlQuery);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [a11yStatus, setA11yStatus] = React.useState('');
  const [mobilePreviewOpen, setMobilePreviewOpen] = React.useState(false);

  const inputRef = React.useRef<HTMLInputElement>(null);

  // Load repository details
  React.useEffect(() => {
    if (!repoId) return;
    api.getRepository(repoId).then(setRepository).catch(() => setRepository(null));
  }, [repoId]);

  // Execute literal code search against backend
  const executeSearch = React.useCallback(
    async (searchQuery: string) => {
      const trimmed = searchQuery.trim();
      if (!repoId) return;
      if (!trimmed) {
        setResults([]);
        setSelectedResult(null);
        setHasSearched(false);
        setSearchError(null);
        setSearchParams({});
        return;
      }

      setLoading(true);
      setSearchError(null);
      setHasSearched(true);
      setSearchParams({ q: trimmed });
      setA11yStatus(`Searching code for "${trimmed}"...`);

      try {
        const res = await realApi.searchRepository(repoId, trimmed, undefined, 50);
        const items = res.results || [];
        setResults(items);
        setSelectedResult(items.length > 0 ? items[0] : null);
        setA11yStatus(`Found ${items.length} code matches for "${trimmed}".`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Search request failed';
        setSearchError(msg);
        setResults([]);
        setSelectedResult(null);
        setA11yStatus(`Search failed: ${msg}`);
      } finally {
        setLoading(false);
      }
    },
    [repoId, setSearchParams]
  );

  // Initial search if URL query param exists on mount
  React.useEffect(() => {
    if (urlQuery && urlQuery.trim()) {
      executeSearch(urlQuery);
    }
  }, [executeSearch, urlQuery]);

  // Global '/' shortcut to focus search input (guarded against active input focus)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (!isInput && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k'))) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Keyboard navigation within search results list (ArrowDown, ArrowUp)
  const handleKeyDownInList = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;
    const currentIndex = selectedResult ? results.findIndex((r) => r.id === selectedResult.id) : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = currentIndex < results.length - 1 ? currentIndex + 1 : 0;
      setSelectedResult(results[nextIndex]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : results.length - 1;
      setSelectedResult(results[prevIndex]);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setSelectedResult(null);
    setHasSearched(false);
    setSearchError(null);
    setSearchParams({});
    inputRef.current?.focus();
  };

  const handleSelectResult = (result: SearchResultItem) => {
    setSelectedResult(result);
    // On mobile (< 1024px), open preview drawer
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobilePreviewOpen(true);
    }
  };

  if (!repository) {
    return (
      <div
        role="status"
        aria-label="Loading repository search"
        className="p-8 text-center text-xs text-text-secondary font-mono"
      >
        Loading repository search…
      </div>
    );
  }

  return (
    <AnimatedPage className="flex flex-col min-h-screen bg-surface-base text-text-primary font-sans">
      <LiveRegion message={a11yStatus} />
      <RepositoryHeader repository={repository} />

      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-10 pb-16 flex flex-col space-y-6">
        {/* Search header & input bar */}
        <section role="search" aria-label="Repository code search" className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-medium text-text-primary tracking-tight">Code Search</h1>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-raised border border-white/10 text-text-secondary">
                  Literal Keyword Match
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                Deterministic lexical search across indexed repository files and symbols.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono text-text-secondary bg-surface-raised border border-white/10 rounded select-none">
                <span>/</span> or <span>⌘K</span>
              </kbd>
            </div>
          </div>

          {/* Search Input Field */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MaterialIcon
                name="search"
                size={18}
                className="absolute left-3.5 top-3 text-text-secondary"
                aria-hidden="true"
              />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    executeSearch(query);
                  } else if (e.key === 'Escape') {
                    handleClear();
                  }
                }}
                aria-label="Code search query"
                placeholder="Search code identifiers, imports, functions, or keywords…"
                className="pl-10 pr-20 h-10 text-xs sm:text-sm bg-surface-raised border-white/10 focus-visible:border-accent text-text-primary placeholder:text-text-tertiary"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Clear search input"
                  className="absolute right-3 top-2.5 p-1 rounded text-text-secondary hover:text-text-primary hover:bg-white/[0.06] transition"
                  title="Clear search"
                >
                  <MaterialIcon name="close" size={16} aria-hidden="true" />
                </button>
              )}
            </div>

            <Button
              onClick={() => executeSearch(query)}
              disabled={loading || !query.trim()}
              className="h-10 px-4 text-xs font-medium gap-1.5"
              aria-label="Execute search"
            >
              {loading ? (
                <MaterialIcon name="sync" size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <MaterialIcon name="search" size={16} aria-hidden="true" />
              )}
              <span>Search</span>
            </Button>
          </div>
        </section>

        {/* Error State */}
        {searchError && (
          <div className="p-3.5 rounded-lg border border-status-failed/40 bg-surface-raised text-xs text-status-failed flex items-center gap-2">
            <MaterialIcon name="error_outline" size={18} aria-hidden="true" />
            <span>{searchError}</span>
          </div>
        )}

        {/* Main Split Pane Results Body */}
        <div
          tabIndex={0}
          onKeyDown={handleKeyDownInList}
          className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[500px] outline-none"
        >
          {/* Left Column: Results List */}
          <div className="lg:col-span-5 flex flex-col space-y-3">
            {hasSearched && (
              <div className="flex items-center justify-between px-1 text-xs text-text-secondary">
                <span>
                  {loading
                    ? 'Searching…'
                    : results.length === 0
                    ? '0 results found'
                    : `${results.length} match${results.length === 1 ? '' : 'es'} found`}
                </span>
                {results.length > 0 && (
                  <span className="font-mono text-xs text-text-tertiary">
                    ↑↓ to navigate
                  </span>
                )}
              </div>
            )}

            {!hasSearched && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center rounded-lg border border-white/10 bg-surface-raised">
                <MaterialIcon name="search" size={32} className="text-text-tertiary mb-3" aria-hidden="true" />
                <h3 className="text-sm font-medium text-text-primary mb-1">Search this repository</h3>
                <p className="text-xs text-text-secondary max-w-xs">
                  Type a function name, class, import path, or token to search literal occurrences in indexed code.
                </p>
              </div>
            )}

            {hasSearched && !loading && results.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center rounded-lg border border-white/10 bg-surface-raised">
                <MaterialIcon name="search_off" size={32} className="text-text-tertiary mb-3" aria-hidden="true" />
                <h3 className="text-sm font-medium text-text-primary mb-1">No matches found</h3>
                <p className="text-xs text-text-secondary max-w-xs">
                  No exact keyword matches found for "{query}". Try checking for spelling or searching a broader term.
                </p>
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-2 overflow-y-auto max-h-[650px] pr-1">
                {results.map((result) => {
                  const isSelected = selectedResult?.id === result.id;
                  return (
                    <div
                      key={result.id}
                      onClick={() => handleSelectResult(result)}
                      className={`
                        p-3 rounded-lg border transition-all cursor-pointer select-none text-xs
                        focus:outline-none focus-visible:ring-1 focus-visible:ring-accent
                        ${
                          isSelected
                            ? 'bg-surface-overlay border-accent shadow-xs ring-1 ring-accent/30'
                            : 'bg-surface-raised border-white/10 hover:border-white/20'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MaterialIcon
                            name="description"
                            size={14}
                            className="text-text-secondary shrink-0"
                            aria-hidden="true"
                          />
                          <span className="font-mono text-xs font-medium text-text-primary truncate">
                            {result.file_path}
                          </span>
                        </div>
                        <span className="shrink-0 text-xs font-mono px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                          L{result.start_line}–L{result.end_line}
                        </span>
                      </div>

                      {/* Snippet Preview */}
                      <pre className="font-mono text-xs text-text-secondary bg-surface-base/80 p-2 rounded border border-white/[0.06] overflow-hidden line-clamp-3 whitespace-pre">
                        <code>{result.snippet}</code>
                      </pre>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Code Preview Split Pane (Desktop) */}
          <div className="hidden lg:block lg:col-span-7 h-[650px]">
            <SearchCodePreview result={selectedResult} repoId={repoId!} />
          </div>
        </div>

        {/* Mobile Slide-Over Sheet / Drawer for Code Preview */}
        {mobilePreviewOpen && selectedResult && (
          <div className="fixed inset-0 z-50 lg:hidden flex flex-col bg-surface-base/80 backdrop-blur-xs p-4">
            <div className="flex-1 max-w-md w-full mx-auto flex flex-col shadow-2xl">
              <SearchCodePreview
                result={selectedResult}
                repoId={repoId!}
                onClose={() => setMobilePreviewOpen(false)}
              />
            </div>
          </div>
        )}
      </main>
    </AnimatedPage>
  );
}
