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
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

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

  React.useEffect(() => {
    if (!repoId) return;
    api.getRepository(repoId).then(setRepository);
  }, [repoId]);

  const executeSearch = React.useCallback(async (q: string) => {
    if (!repoId) return;
    setLoading(true);
    try {
      const res = await api.searchCode(repoId, q);
      setResults(res.results);
      setFilters(res.filters);
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
    setTimeout(() => setCopiedPath(null), 2000);
  };

  if (!repository) {
    return <div className="p-8 text-center text-xs text-[var(--color-muted)]">Loading repository...</div>;
  }

  const filteredResults = results.filter((r) => {
    if (selectedExt && !r.file_path.endsWith(selectedExt)) return false;
    if (selectedType && r.symbol_type?.toLowerCase() !== selectedType.toLowerCase()) return false;
    return true;
  });

  return (
    <div className="flex flex-col min-h-full bg-[var(--color-page)]">
      <RepositoryHeader repository={repository} />

      <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Search Input Bar */}
        <div className="flex gap-2 max-w-3xl">
          <div className="relative flex-1">
            <SearchIcon size={15} className="absolute left-3 top-3 text-[var(--color-muted)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && executeSearch(query)}
              placeholder="Search code symbols, identifiers, files, or semantic concepts..."
              className="pl-9 h-11 text-xs sm:text-sm bg-[var(--color-surface)] shadow-sm"
              autoFocus
            />
          </div>
          <Button onClick={() => executeSearch(query)} className="h-11 px-5">
            Search
          </Button>
        </div>

        {/* Results layout: Filters sidebar + Results list */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Facets Sidebar */}
          {filters && (
            <div className="space-y-5 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--color-text)] pb-2 border-b border-[var(--color-border)]">
                <Filter size={13} className="text-[var(--color-accent)]" />
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
                >
                  Clear all filters
                </Button>
              )}
            </div>
          )}

          {/* Results List */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between text-xs text-[var(--color-muted)] px-1">
              <span>
                Found <span className="text-[var(--color-text)] font-semibold">{filteredResults.length}</span> code matches for "{query}"
              </span>
              <span className="font-mono text-[11px]">Ranked via Hybrid RRF</span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-[var(--color-muted)]">
                Executing hybrid vector & lexical search...
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="p-12 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] text-center space-y-2">
                <SearchIcon size={24} className="text-[var(--color-muted)] mx-auto" />
                <h4 className="text-sm font-semibold text-[var(--color-text)]">No code matches found</h4>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Try searching for a function name, AST node, or broader keywords.
                </p>
              </div>
            ) : (
              filteredResults.map((result, idx) => (
                <div
                  key={idx}
                  className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm hover:border-[var(--color-border-strong)] transition"
                >
                  {/* Result Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[var(--color-raised)]/50 border-b border-[var(--color-border)] text-xs">
                    <div className="flex items-center gap-2 font-mono">
                      <FileCode size={14} className="text-[var(--color-accent)] shrink-0" />
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
                      >
                        {copiedPath === result.file_path ? (
                          <Check size={13} className="text-[var(--color-accent)]" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          navigate(`/repositories/${repoId}/files?path=${encodeURIComponent(result.file_path)}`)
                        }
                        title="Open file viewer"
                      >
                        <ExternalLink size={13} />
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
                    >
                      <MessageSquare size={11} />
                      <span>Ask about this in Chat</span>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
