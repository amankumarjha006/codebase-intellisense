'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, RepositoryListItemOut, RepositoryOut, CurrentUser, ApiError } from '@/lib/api';
import { deriveRowStatus, getFailureMessage, IN_PROGRESS_STATUSES } from '@/lib/status';
import { mapErrorToCopy } from '@/lib/errors';
import { Search, Plus, MoreVertical, RefreshCw, CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { ConnectDrawer } from '@/components/repositories/ConnectDrawer';

function getRelativeTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

/** Small copyable "Reference: <id>" block for error states. */
function RequestIdRef({ id }: { id?: string }) {
  if (!id) return null;
  return (
    <span className="text-[11px] text-muted-foreground/80 font-mono flex items-center gap-1 mt-1 select-all">
      Reference: {id}
      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(id)}
        className="hover:text-foreground transition-colors"
        aria-label="Copy reference ID"
      >
        <Copy size={11} />
      </button>
    </span>
  );
}

function RowStatusContent({ repo, onAction }: { repo: RepositoryListItemOut; onAction: (e: React.MouseEvent) => void }) {
  const derivation = deriveRowStatus(repo.latest_job_status, repo.active_version_short_sha);
  const failureMessage = getFailureMessage(repo.latest_job_failure_code);
  const shouldReduceMotion = useReducedMotion();
  const transition = { duration: shouldReduceMotion ? 0 : 0.3 };

  if (derivation.kind === 'not-indexed') {
    return (
      <motion.div
        key="not-indexed"
        initial={{ opacity: shouldReduceMotion ? 1 : 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: shouldReduceMotion ? 1 : 0 }}
        transition={transition}
        className="flex items-center gap-3"
      >
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border text-muted-foreground text-xs font-medium">
          {derivation.label}
        </div>
        {derivation.actions.includes('index') && (
          <button
            onClick={onAction}
            className="text-xs font-medium text-foreground hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1 relative z-20"
          >
            Index repository
          </button>
        )}
      </motion.div>
    );
  }

  if (derivation.kind === 'in-progress') {
    return (
      <motion.div
        key="in-progress"
        initial={{ opacity: shouldReduceMotion ? 1 : 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: shouldReduceMotion ? 1 : 0 }}
        transition={transition}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border text-foreground text-xs font-medium relative overflow-hidden"
      >
        <RefreshCw size={12} className={shouldReduceMotion ? '' : 'animate-spin'} />
        {derivation.label}
        {derivation.showProgress && (
          shouldReduceMotion
            ? <div className="absolute bottom-0 left-0 h-[2px] bg-foreground/30 w-full" />
            : <div className="absolute bottom-0 left-0 h-[2px] bg-foreground/20 w-full animate-progress-line origin-left" />
        )}
      </motion.div>
    );
  }

  if (derivation.kind === 'failed') {
    return (
      <motion.div
        key="failed"
        initial={{ opacity: shouldReduceMotion ? 1 : 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: shouldReduceMotion ? 1 : 0 }}
        transition={transition}
        className="flex items-center gap-3"
      >
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-red-400 text-xs font-medium border border-red-500/30 bg-red-500/10">
          <AlertCircle size={12} />
          {derivation.label}
        </div>
        <span className="text-xs text-muted-foreground max-w-[200px] truncate" title={failureMessage}>
          {failureMessage}
        </span>
        {derivation.actions.includes('retry') && (
          <button
            onClick={onAction}
            className="text-xs font-medium text-foreground hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1 relative z-20"
          >
            Retry indexing
          </button>
        )}
      </motion.div>
    );
  }

  if (derivation.kind === 'ready') {
    return (
      <motion.div
        key="ready"
        initial={{ opacity: shouldReduceMotion ? 1 : 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: shouldReduceMotion ? 1 : 0 }}
        transition={transition}
        className="flex flex-col items-end gap-1"
      >
        <div className="flex items-center gap-2">
          {derivation.subtitle === 'Updating…' && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              Updating…
            </span>
          )}
          {derivation.subtitle === 'Last update failed' && (
            <span className="text-xs text-muted-foreground max-w-[200px] truncate" title={failureMessage}>
              {failureMessage}
            </span>
          )}
          {derivation.actions.includes('retry') && (
            <button
              onClick={onAction}
              className="text-xs font-medium text-foreground hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1 relative z-20"
            >
              Retry indexing
            </button>
          )}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent-soft text-accent border border-accent-border text-xs font-medium relative overflow-hidden">
            <CheckCircle2 size={12} />
            {derivation.label}
            {derivation.showProgress && (
              shouldReduceMotion
                ? <div className="absolute bottom-0 left-0 h-[2px] bg-accent/40 w-full" />
                : <div className="absolute bottom-0 left-0 h-[2px] bg-accent/40 w-full animate-progress-line origin-left" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
          {repo.active_version_short_sha && <span>{repo.active_version_short_sha}</span>}
          {repo.last_indexed_at && (
            <span title={new Date(repo.last_indexed_at).toLocaleString()}>
              Last indexed {getRelativeTime(repo.last_indexed_at)}
            </span>
          )}
        </div>
      </motion.div>
    );
  }

  return null;
}

function RowStatus({ repo, onAction }: { repo: RepositoryListItemOut; onAction: (e: React.MouseEvent) => void }) {
  return (
    <div aria-live="polite" aria-atomic="true" className="relative flex items-center justify-end min-h-[32px] min-w-[200px]">
      <AnimatePresence mode="wait">
        <RowStatusContent key={repo.id + '-' + (repo.latest_job_status || 'none')} repo={repo} onAction={onAction} />
      </AnimatePresence>
    </div>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryQ = searchParams.get('q') || '';
  const isConnectOpen = searchParams.get('connect') === '1';

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [repositories, setRepositories] = useState<RepositoryListItemOut[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  /** Stores the user-facing copy and optional request ID — never raw err.message. */
  const [error, setError] = useState<{ copy: string; requestId?: string } | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(queryQ);
  const [analyzeRepo, setAnalyzeRepo] = useState<RepositoryListItemOut | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const limit = 50;

  // Refs for polling and in-flight guard
  const repositoriesRef = useRef(repositories);
  const pageRef = useRef(page);
  const searchRef = useRef(search);

  useEffect(() => {
    repositoriesRef.current = repositories;
  }, [repositories]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  const inFlightRef = useRef(false);
  const pollStartTimeRef = useRef<number | null>(null);
  const consecutiveErrorsRef = useRef<number>(0);

  // Feature flags
  const conversationsFlag = false;

  useEffect(() => {
    async function checkAuth() {
      try {
        const u = await api.getCurrentUser();
        setUser(u);
      } catch (e: unknown) {
        const err = e as { code?: string; status?: number };
        if (err.code === 'UNAUTHENTICATED' || err.status === 401) {
          router.push('/?error=session_expired');
        } else {
          router.push('/');
        }
      } finally {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  const loadRepositories = useCallback(async (currentPage: number, currentSearch: string) => {
    if (authLoading) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.listRepositories(currentPage, limit, currentSearch);
      setRepositories(data.items);
      setTotal(data.total);
      setHasMore(data.has_more);
    } catch (e: unknown) {
      const apiErr = e as ApiError;
      if (apiErr.code === 'UNAUTHENTICATED' || apiErr.status === 401) {
        router.push('/?error=session_expired');
      } else {
        const copy = mapErrorToCopy(apiErr);
        if (copy === null) {
          // 401 already handled above, but guard
          router.push('/?error=session_expired');
        } else {
          setError({ copy, requestId: apiErr.requestId });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [authLoading, limit, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRepositories(page, search);
  }, [page, search, loadRepositories]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      if (search !== queryQ) {
        const params = new URLSearchParams(window.location.search);
        if (search) params.set('q', search);
        else params.delete('q');
        router.replace(`?${params.toString()}`, { scroll: false });
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [search, queryQ, router]);

  // Polling logic with chained setTimeout loop
  const hasInProgress = repositories.some(
    (r) => r.latest_job_status && (IN_PROGRESS_STATUSES as readonly string[]).includes(r.latest_job_status)
  );

  useEffect(() => {
    if (!hasInProgress) {
      pollStartTimeRef.current = null;
      consecutiveErrorsRef.current = 0;
      return;
    }

    if (pollStartTimeRef.current === null) {
      pollStartTimeRef.current = Date.now();
    }

    let isMounted = true;
    let timer: NodeJS.Timeout | null = null;
    const abortController = new AbortController();

    const poll = async () => {
      if (!isMounted || document.hidden || inFlightRef.current) {
        return;
      }

      const visibleInProgress = repositoriesRef.current.some(
        (r) => r.latest_job_status && (IN_PROGRESS_STATUSES as readonly string[]).includes(r.latest_job_status)
      );
      if (!visibleInProgress) {
        pollStartTimeRef.current = null;
        consecutiveErrorsRef.current = 0;
        return;
      }

      inFlightRef.current = true;
      let nextDelay = 4000;

      try {
        const data = await api.listRepositories(
          pageRef.current,
          limit,
          searchRef.current,
          { signal: abortController.signal }
        );

        if (isMounted) {
          setRepositories(data.items);
          setTotal(data.total);
          setHasMore(data.has_more);

          consecutiveErrorsRef.current = 0;
          setRefreshError(null);

          const stillInProgress = data.items.some(
            (r) => r.latest_job_status && (IN_PROGRESS_STATUSES as readonly string[]).includes(r.latest_job_status)
          );

          if (!stillInProgress) {
            pollStartTimeRef.current = null;
            return;
          }

          const elapsed = Date.now() - (pollStartTimeRef.current || Date.now());
          nextDelay = elapsed >= 60000 ? 10000 : 4000;
        }
      } catch (err: unknown) {
        if (!isMounted || abortController.signal.aborted) {
          return;
        }

        const apiErr = err as ApiError;

        // On 401, stop polling and redirect to session-expired flow
        if (apiErr?.status === 401) {
          router.push('/?error=session_expired');
          return;
        }

        // On 404, stop polling and show mapped copy
        if (apiErr?.status === 404) {
          setError({ copy: mapErrorToCopy(apiErr)!, requestId: apiErr?.requestId });
          return;
        }

        if (apiErr?.status === 429) {
          // Retry-After is already capped at 120s by fetchWrapper
          nextDelay = apiErr.retryAfter ? apiErr.retryAfter * 1000 : 8000;
        } else {
          consecutiveErrorsRef.current += 1;
          const step = consecutiveErrorsRef.current;
          nextDelay = Math.min(step * 10000, 30000);
          setRefreshError("Can't refresh status");
        }
      } finally {
        inFlightRef.current = false;
        if (isMounted && !document.hidden) {
          const stillActive = repositoriesRef.current.some(
            (r) => r.latest_job_status && (IN_PROGRESS_STATUSES as readonly string[]).includes(r.latest_job_status)
          );
          if (stillActive) {
            timer = setTimeout(poll, nextDelay);
          }
        }
      }
    };

    timer = setTimeout(poll, 4000);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      } else {
        const stillActive = repositoriesRef.current.some(
          (r) => r.latest_job_status && (IN_PROGRESS_STATUSES as readonly string[]).includes(r.latest_job_status)
        );
        if (stillActive && !inFlightRef.current) {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
          poll();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      abortController.abort();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasInProgress, limit, router]);

  const handleConnectOpenChange = useCallback((open: boolean) => {
    const params = new URLSearchParams(window.location.search);
    if (open) {
      params.set('connect', '1');
    } else {
      params.delete('connect');
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router]);

  const handleConnectSuccess = useCallback((repo: RepositoryOut) => {
    const newRepo: RepositoryListItemOut = {
      ...repo,
      latest_job_status: null,
      latest_job_failure_code: null,
      active_version_short_sha: null,
      last_indexed_at: null,
    };
    setRepositories((prev) => [newRepo, ...prev]);
    setPage(1);
    loadRepositories(1, search);
  }, [loadRepositories, search]);

  if (authLoading) {
    return <div className="h-full flex items-center justify-center text-muted-foreground">Checking session...</div>;
  }

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-[1100px] mx-auto w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-foreground tracking-tight">Dashboard</h1>
          {user?.full_name && (
            <p className="text-muted-foreground mt-1">Welcome back, {user.full_name}</p>
          )}
        </div>
        <Button asChild>
          <Link href="?connect=1" className="gap-2" scroll={false}>
            <Plus size={16} />
            Connect repository
          </Link>
        </Button>
      </div>

      {/* Actions bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative w-full sm:max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-3 py-2 border border-border rounded-md leading-5 bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            placeholder="Search repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {total} {total === 1 ? 'repository' : 'repositories'}
        </div>
      </div>

      {/* Conversations Flag Section */}
      {conversationsFlag && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Continue where you left off</h2>
          {/* To be implemented when backend supports conversations */}
          <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-6 text-center">
            Recent conversations will appear here
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mb-6 bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-md text-sm flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error.copy}</span>
          </div>
          <RequestIdRef id={error.requestId} />
          <div className="mt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadRepositories(page, search)}
              className="text-foreground"
            >
              <RefreshCw size={14} className="mr-1.5" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Small polling status note */}
      {refreshError && (
        <div className="mb-4 flex items-center gap-2 text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-md" role="status">
          <AlertCircle size={14} />
          <span>{refreshError}</span>
        </div>
      )}

      {/* Repository List */}
      <div className="flex-1 overflow-auto -mx-4 sm:mx-0">
        <div className="min-w-full inline-block align-middle">
          {loading && repositories.length === 0 ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse bg-muted/20 h-16 rounded-md border border-border" />
              ))}
            </div>
          ) : repositories.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-lg">
              <h3 className="mt-2 text-sm font-semibold text-foreground">No repositories found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {search ? 'Try adjusting your search query.' : 'Get started by connecting a GitHub repository.'}
              </p>
              {!search && (
                <div className="mt-6">
                  <Button asChild>
                    <Link href="?connect=1" scroll={false}>
                      <Plus size={16} className="mr-2" />
                      Connect repository
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-border rounded-lg bg-card overflow-hidden">
              <ul className="divide-y divide-border/50">
                <AnimatePresence initial={false}>
                  {repositories.map((repo) => (
                    <motion.li
                      key={repo.id}
                      layout
                      initial={{ opacity: 0, backgroundColor: 'var(--raised)' }}
                      animate={{ opacity: 1, backgroundColor: 'transparent' }}
                      transition={{ duration: 1.2 }}
                      className="relative hover:bg-muted/30 transition-colors group"
                    >
                      <div className="flex items-center px-4 py-4 sm:px-6">
                        <div className="min-w-0 flex-1 flex items-center justify-between">
                        <div className="truncate">
                          <Link href={`/repositories/${repo.id}`} className="focus:outline-none">
                            {/* whole-row link overlay */}
                            <span className="absolute inset-0" aria-hidden="true" />
                            <p className="text-sm font-medium text-foreground truncate flex items-center gap-2">
                              {repo.owner} <span className="text-muted-foreground">/</span> {repo.name}
                              {repo.is_private && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border border-border">
                                  Private
                                </span>
                              )}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Connected {new Date(repo.created_at).toLocaleDateString()}
                            </p>
                          </Link>
                        </div>
                        <div className="ml-4 flex-shrink-0 flex items-center gap-4 relative z-10">
                           <RowStatus repo={repo} onAction={(e) => { e.preventDefault(); e.stopPropagation(); setAnalyzeRepo(repo); }} />
                           <button className="text-muted-foreground hover:text-foreground p-1 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                             <MoreVertical size={16} />
                           </button>
                        </div>
                      </div>
                    </div>
                  </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {repositories.length > 0 && (
        <div className="mt-6 flex items-center justify-between py-3">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm font-medium text-foreground bg-background border border-border rounded-md disabled:opacity-50 hover:bg-muted transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={!hasMore}
            className="px-3 py-1.5 text-sm font-medium text-foreground bg-background border border-border rounded-md disabled:opacity-50 hover:bg-muted transition-colors"
          >
            Next
          </button>
        </div>
      )}

      <ConnectDrawer
        open={isConnectOpen || analyzeRepo !== null}
        onOpenChange={(open) => {
          if (!open) setAnalyzeRepo(null);
          handleConnectOpenChange(open);
        }}
        onSuccess={handleConnectSuccess}
        initialRepository={analyzeRepo as unknown as RepositoryOut}
        onAnalyzeStart={() => loadRepositories(page, search)}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center text-muted-foreground">Loading dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
