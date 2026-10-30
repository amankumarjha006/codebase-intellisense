import * as React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { api } from '../lib/api';
import { Repository, SearchResult, SearchFilters } from '../lib/types';
import { RepositoryHeader } from '../components/repository/RepositoryHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge, StatusChip } from '../components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Skeleton } from '../components/ui/skeleton';
import { Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip';
import { AnimatedPage } from '../components/ui/AnimatedPage';
import { LiveRegion } from '../components/ui/A11y';

const SUGGESTED_QUERIES = [
  'authentication',
  'database',
  'api',
  'handler',
  'config',
  'service',
  'utils',
];

export function SearchPage() {
  const { id: repoId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlQuery = searchParams.get('q') || '';
  const [repository, setRepository] = React.useState<Repository | null>(null);
  const [query, setQuery] = React.useState(urlQuery);
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [filters, setFilters] = React.useState<SearchFilters | null>(null);
  const [selectedExt, setSelectedExt] = React.useState<string | null>(null);
  const [selectedDir, setSelectedDir] = React.useState<string | null>(null);
  const [selectedType, setSelectedType] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(!!urlQuery);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [copiedPath, setCopiedPath] = React.useState<string | null>(null);
  const [a11yStatus, setA11yStatus] = React.useState('');

  const inputRef = React.useRef<HTMLInputElement>(null);

  // Load repository details
  React.useEffect(() => {
    if (!repoId) return;
    api.getRepository(repoId).then(setRepository).catch(() => setRepository(null));
  }, [repoId]);

  // Execute search callback
  const executeSearch = React.useCallback(
    async (searchQuery: string) => {
      const trimmed = searchQuery.trim();
      if (!repoId) return;
      if (!trimmed) {
        setResults([]);
        setFilters(null);
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
        const res = await api.searchCode(repoId, trimmed);
        setResults(res.results || []);
        setFilters(res.filters || null);
        setA11yStatus(`Found ${res.results?.length ?? 0} code matches for "${trimmed}".`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Search request failed';
        setSearchError(msg);
        setResults([]);
        setFilters(null);
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

  // Global '/' shortcut to focus search input
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (!isInput && e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setFilters(null);
    setSelectedExt(null);
    setSelectedDir(null);
    setSelectedType(null);
    setHasSearched(false);
    setSearchError(null);
    setSearchParams({});
    inputRef.current?.focus();
  };

  const handleCopy = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setA11yStatus(`Copied path ${path}`);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const handleSuggestedClick = (suggested: string) => {
    setQuery(suggested);
    executeSearch(suggested);
  };

  // Filter results client-side by active facets
  const filteredResults = React.useMemo(() => {
    return results.filter((r) => {
      if (selectedExt && !r.file_path.endsWith(selectedExt)) return false;
      if (selectedDir && !r.file_path.startsWith(selectedDir)) return false;
      if (selectedType && r.symbol_type?.toLowerCase() !== selectedType.toLowerCase()) return false;
      return true;
    });
  }, [results, selectedExt, selectedDir, selectedType]);

  if (!repository) {
    return (
      <div
        role="status"
        aria-label="Loading repository search"
        className="p-8 text-center text-xs text-[var(--color-muted)]"
      >
        Loading repository search...
      </div>
    );
  }

  const isRepoUnready =
    repository.latest_job_status === 'FAILED' ||
    (!repository.indexed_commit && !repository.active_version_short_sha && repository.latest_job_status !== 'READY');

  return (
    <AnimatedPage className="flex flex-col min-h-full bg-[var(--color-page)]">
      <LiveRegion message={a11yStatus} />
      <RepositoryHeader repository={repository} />

      <main id="main-content" className="p-4 sm:p-6 max-w-7xl mx-auto w-full">
        <div className="space-y-6">
          {/* Warning banner if repository is not yet indexed */}
          {isRepoUnready && (
            <Card className="border-[rgba(251,191,36,0.35)] bg-[var(--color-warning-tint)] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[var(--color-warning)]">
              <div className="flex items-center gap-2.5">
                <MaterialIcon name="warning" size={18} fill={1} className="shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
                <div>
                  <span className="font-semibold">Repository indexing required.</span>{' '}
                  Code search requires an indexed repository to find symbols and functions. Current status:{' '}
                  <StatusChip status={repository.latest_job_status} size="sm" className="inline-flex ml-1" />
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/repositories/${repoId}`)}
                className="h-7 text-xs border-[rgba(251,191,36,0.4)] text-[var(--color-text)] hover:bg-[var(--color-warning-tint)] shrink-0"
              >
                View Repository Overview
              </Button>
            </Card>
          )}

          {/* Search Controls Bar */}
          <section role="search" aria-label="Repository code search" className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2 max-w-4xl">
              <div className="relative flex-1">
                <MaterialIcon
                  name="search"
                  size={18}
                  className="absolute left-3.5 top-3 text-[var(--color-muted)]"
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
                  placeholder="Search functions, classes, AST symbols, identifiers, or keywords..."
                  className="pl-10 pr-20 h-11 text-xs sm:text-sm bg-[var(--color-surface)] border-[var(--color-border)] shadow-xs focus-visible:border-[var(--color-accent)]"
                  autoFocus
                />
                <div className="absolute right-3 top-2.5 flex items-center gap-1.5">
                  {query && (
                    <button
                      type="button"
                      onClick={handleClear}
                      aria-label="Clear search input"
                      className="p-1 rounded text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)] transition cursor-pointer"
                      title="Clear search"
                    >
                      <MaterialIcon name="close" size={16} aria-hidden="true" />
                    </button>
                  )}
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-muted)] bg-[var(--color-raised)] border border-[var(--color-border)] rounded select-none">
                    /
                  </kbd>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => executeSearch(query)}
                  disabled={loading}
                  className="h-11 px-5 text-xs font-semibold gap-1.5"
                  aria-label="Execute search"
                >
                  <MaterialIcon name="search" size={16} aria-hidden="true" />
                  <span>Search</span>
                </Button>

                {hasSearched && (
                  <Button
                    variant="ghost"
                    onClick={handleClear}
                    className="h-11 px-3 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
                    aria-label="Reset search"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Quick Suggestions Chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] text-[var(--color-muted)] mr-1">Quick searches:</span>
              {SUGGESTED_QUERIES.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => handleSuggestedClick(term)}
                  className="px-2 py-0.5 rounded text-[11px] font-mono bg-[var(--color-surface)] hover:bg-[var(--color-raised)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-mint-accent,#B9E4D0)] transition cursor-pointer"
                >
                  {term}
                </button>
              ))}
            </div>
          </section>

          <Separator />

          {/* Results Area with Responsive Filters Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            {/* Facets Sidebar (shown when filters exist) */}
            {filters && (filters.extensions.length > 0 || filters.directories.length > 0 || filters.symbol_types.length > 0) && (
              <Card className="border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-xs shadow-xs space-y-5">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
                  <div className="flex items-center gap-1.5 font-semibold text-[var(--color-text)]">
                    <MaterialIcon name="filter_list" size={16} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                    <span>Filters & Facets</span>
                  </div>
                  {(selectedExt || selectedDir || selectedType) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedExt(null);
                        setSelectedDir(null);
                        setSelectedType(null);
                      }}
                      className="text-[10px] text-[var(--color-mint-accent,#B9E4D0)] hover:underline cursor-pointer"
                      aria-label="Reset all active filters"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* File Extensions */}
                {filters.extensions.length > 0 && (
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
                          className={`w-full flex items-center justify-between px-2.5 py-1 rounded text-left transition cursor-pointer ${
                            selectedExt === ext.ext
                              ? 'bg-[var(--color-mint-selected-bg,#253A32)] text-[var(--color-mint-accent,#B9E4D0)] font-medium border border-[rgba(185,228,208,0.22)]'
                              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-raised)]/70'
                          }`}
                        >
                          <span className="font-mono text-xs">{ext.ext || 'no-ext'}</span>
                          <span className="text-[10px] font-mono text-[var(--color-muted)]">{ext.count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Directories */}
                {filters.directories.length > 0 && (
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] block mb-2">
                      Directory
                    </label>
                    <div className="space-y-1">
                      {filters.directories.map((dir) => (
                        <button
                          key={dir.dir}
                          onClick={() => setSelectedDir(selectedDir === dir.dir ? null : dir.dir)}
                          aria-pressed={selectedDir === dir.dir}
                          className={`w-full flex items-center justify-between px-2.5 py-1 rounded text-left transition cursor-pointer ${
                            selectedDir === dir.dir
                              ? 'bg-[var(--color-mint-selected-bg,#253A32)] text-[var(--color-mint-accent,#B9E4D0)] font-medium border border-[rgba(185,228,208,0.22)]'
                              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-raised)]/70'
                          }`}
                        >
                          <span className="font-mono text-xs truncate max-w-[160px]">{dir.dir}</span>
                          <span className="text-[10px] font-mono text-[var(--color-muted)]">{dir.count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Symbol Types (Extracted from AST) */}
                {filters.symbol_types.length > 0 && (
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
                          className={`w-full flex items-center justify-between px-2.5 py-1 rounded text-left transition cursor-pointer ${
                            selectedType === st.type
                              ? 'bg-[var(--color-mint-selected-bg,#253A32)] text-[var(--color-mint-accent,#B9E4D0)] font-medium border border-[rgba(185,228,208,0.22)]'
                              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-raised)]/70'
                          }`}
                        >
                          <span className="capitalize">{st.type}</span>
                          <span className="text-[10px] font-mono text-[var(--color-muted)]">{st.count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Results Section */}
            <section
              aria-label="Code search results"
              className={filters && (filters.extensions.length > 0 || filters.directories.length > 0 || filters.symbol_types.length > 0) ? 'lg:col-span-3 space-y-4' : 'col-span-1 lg:col-span-4 space-y-4'}
            >
              {/* Header Status Bar (when query has been submitted) */}
              {hasSearched && !loading && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-muted)] px-1">
                  <div className="flex items-center gap-2">
                    <span>
                      Found <span className="text-[var(--color-text)] font-semibold">{filteredResults.length}</span> code matches for &ldquo;<span className="text-[var(--color-text)] font-medium">{query}</span>&rdquo;
                    </span>
                    {(selectedExt || selectedDir || selectedType) && (
                      <Badge variant="accent" className="text-[11px]">
                        Filtered ({[selectedExt, selectedDir, selectedType].filter(Boolean).join(', ')})
                      </Badge>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-[var(--color-muted)]">
                    Ranked via Hybrid RRF
                  </span>
                </div>
              )}

              {/* State 1: Loading Skeleton */}
              {loading && (
                <div className="space-y-4" role="status" aria-label="Searching codebase">
                  {[1, 2, 3].map((n) => (
                    <Card key={n} className="border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-5 w-64" />
                        <Skeleton className="h-5 w-24" />
                      </div>
                      <Skeleton className="h-24 w-full rounded" />
                      <div className="flex items-center justify-between pt-1">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-6 w-32" />
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* State 2: Error State */}
              {!loading && searchError && (
                <Card className="border-[rgba(248,113,113,0.35)] bg-[var(--color-error-tint)] p-8 text-center space-y-3" role="alert">
                  <MaterialIcon name="error" size={32} className="text-[var(--color-error)] mx-auto" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">Search Failed</h3>
                  <p className="text-xs text-[var(--color-text-secondary)] max-w-md mx-auto">
                    {searchError}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => executeSearch(query)}
                    className="border-[rgba(248,113,113,0.4)] text-[var(--color-text)] hover:bg-[var(--color-error-tint)]"
                  >
                    Try Again
                  </Button>
                </Card>
              )}

              {/* State 3: Initial Empty State (No query yet) */}
              {!loading && !hasSearched && (
                <Card className="border-[var(--color-border)] bg-[var(--color-surface)] p-8 sm:p-12 text-center space-y-4">
                  <div className="p-3 rounded-full bg-[var(--color-mint-selected-bg,#253A32)] border border-[rgba(185,228,208,0.22)] w-fit mx-auto">
                    <MaterialIcon name="find_in_page" size={32} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                  </div>
                  <div className="space-y-1.5 max-w-md mx-auto">
                    <h3 className="text-base font-semibold text-[var(--color-text)]">
                      Codebase & AST Symbol Search
                    </h3>
                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                      Search functions, classes, type definitions, and semantic code patterns across all indexed source files in this repository.
                    </p>
                  </div>

                  <div className="pt-2 flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                    {SUGGESTED_QUERIES.map((term) => (
                      <button
                        key={term}
                        onClick={() => handleSuggestedClick(term)}
                        className="px-3 py-1 rounded-[var(--radius-control)] text-xs font-mono bg-[var(--color-raised)] hover:bg-[var(--color-raised)]/80 border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-mint-accent,#B9E4D0)] transition cursor-pointer"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </Card>
              )}

              {/* State 4: No Matches Found */}
              {!loading && hasSearched && !searchError && filteredResults.length === 0 && (
                <Card className="border-[var(--color-border)] bg-[var(--color-surface)] p-8 sm:p-12 text-center space-y-4" role="status">
                  <div className="p-3 rounded-full bg-[var(--color-raised)] border border-[var(--color-border)] w-fit mx-auto">
                    <MaterialIcon name="search_off" size={32} className="text-[var(--color-muted)]" aria-hidden="true" />
                  </div>
                  <div className="space-y-1.5 max-w-md mx-auto">
                    <h3 className="text-sm font-semibold text-[var(--color-text)]">
                      No code matches found for &ldquo;{query}&rdquo;
                    </h3>
                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                      Try searching for a function or class identifier, checking for typos, or removing active facet filters.
                    </p>
                  </div>
                  <div className="flex justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleClear} className="text-xs">
                      Clear Search & Filters
                    </Button>
                  </div>
                </Card>
              )}

              {/* State 5: Search Result Cards */}
              {!loading &&
                filteredResults.map((result, idx) => {
                  const lineCount = (result.end_line || result.start_line) - (result.start_line || 1) + 1;
                  const snippetLines = result.snippet ? result.snippet.split('\n') : [];

                  return (
                    <Card
                      key={idx}
                      aria-label={`Match in ${result.file_path}`}
                      className="border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-xs hover:border-[var(--color-border-strong)] transition-all"
                    >
                      {/* Result Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 sm:px-4 bg-[var(--color-raised)]/50 border-b border-[var(--color-border)] text-xs">
                        <div className="flex items-center gap-2 font-mono min-w-0">
                          <MaterialIcon
                            name="description"
                            size={16}
                            fill={1}
                            color="var(--color-mint-accent, #B9E4D0)"
                            className="shrink-0"
                            aria-hidden="true"
                          />
                          <span className="font-semibold text-[var(--color-text)] truncate" title={result.file_path}>
                            {result.file_path}
                          </span>
                          <Badge variant="outline" className="font-mono text-[10px] text-[var(--color-muted)]">
                            L{result.start_line}–{result.end_line}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Symbol badge if identified */}
                          {result.symbol_type && (
                            <Badge variant="accent" className="font-mono text-[10px]">
                              {result.symbol_type}
                            </Badge>
                          )}

                          {/* Relevance score if available */}
                          {result.score !== undefined && result.score !== null && (
                            <Badge variant="outline" className="hidden sm:inline-flex font-mono text-[10px] text-[var(--color-muted)]">
                              Score: {Number(result.score).toFixed(2)}
                            </Badge>
                          )}

                          {/* Copy file path */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleCopy(result.file_path)}
                                aria-label={`Copy file path ${result.file_path}`}
                              >
                                {copiedPath === result.file_path ? (
                                  <MaterialIcon name="check" size={16} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                                ) : (
                                  <MaterialIcon name="content_copy" size={16} aria-hidden="true" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {copiedPath === result.file_path ? 'Copied!' : 'Copy path'}
                            </TooltipContent>
                          </Tooltip>

                          {/* Open in File Viewer */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => {
                                  const lineQuery = result.start_line > 0 ? `&start_line=${result.start_line}&end_line=${result.end_line}` : '';
                                  navigate(`/repositories/${repoId}/files?path=${encodeURIComponent(result.file_path)}${lineQuery}`);
                                }}
                                aria-label={`Open file ${result.file_path} in code viewer`}
                              >
                                <MaterialIcon name="open_in_new" size={16} aria-hidden="true" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Open in code viewer</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>

                      {/* Code Snippet with line number gutter */}
                      <div
                        className="p-3 sm:p-4 bg-[var(--color-page)] font-mono text-xs overflow-x-auto text-[var(--color-text-secondary)] leading-relaxed select-text"
                        tabIndex={0}
                        role="region"
                        aria-label={`Code match snippet for ${result.file_path}`}
                      >
                        <table className="w-full border-collapse">
                          <tbody>
                            {snippetLines.map((line, lIdx) => {
                              const lineNum = (result.start_line || 1) + lIdx;
                              return (
                                <tr key={lIdx} className="hover:bg-[var(--color-raised)]/30 transition-colors">
                                  <td className="w-10 select-none pr-3 text-right text-[11px] text-[var(--color-muted)] font-mono opacity-60">
                                    {lineNum}
                                  </td>
                                  <td className="pl-3 text-[var(--color-text)] whitespace-pre font-mono">
                                    {line || ' '}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Result Footer */}
                      <div className="p-2.5 px-3 sm:px-4 bg-[var(--color-surface)] border-t border-[var(--color-border)]/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--color-muted)]">
                          {result.context_function ? (
                            <>
                              <MaterialIcon name="code" size={14} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                              <span className="truncate max-w-xs">{result.context_function}</span>
                            </>
                          ) : (
                            <span>{lineCount} lines matching query</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const lineQuery = result.start_line > 0 ? `&start_line=${result.start_line}&end_line=${result.end_line}` : '';
                              navigate(`/repositories/${repoId}/files?path=${encodeURIComponent(result.file_path)}${lineQuery}`);
                            }}
                            className="h-7 text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                          >
                            <span>View Source</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              navigate(`/repositories/${repoId}/chat`)
                            }
                            className="h-7 text-[11px] gap-1 text-[var(--color-mint-accent,#B9E4D0)] hover:text-[var(--color-mint-accent,#B9E4D0)] hover:bg-[var(--color-mint-selected-bg,#253A32)]/50"
                            aria-label="Ask about this code in Chat"
                          >
                            <MaterialIcon name="chat" size={14} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
                            <span>Ask in Chat</span>
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
            </section>
          </div>
        </div>
      </main>
    </AnimatedPage>
  );
}
