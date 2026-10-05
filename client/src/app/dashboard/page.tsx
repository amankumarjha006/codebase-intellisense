'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, RepositoryListItemOut, RepositoryOut, CurrentUser } from '@/lib/api';
import { Search, Plus, MoreVertical, RefreshCw, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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

function RowStatusContent({ repo, onAction }: { repo: RepositoryListItemOut, onAction: (e: React.MouseEvent) => void }) {
  const hasActiveVersion = !!repo.active_version_short_sha;
  const status = repo.latest_job_status;
  const isInProgress = ['QUEUED', 'FETCHING', 'INDEXING', 'ANALYZING'].includes(status || '');
  const isFailed = status === 'FAILED';

  if (!hasActiveVersion && !status) {
    return (
      <motion.div
        key="not-indexed"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-3"
      >
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border text-muted-foreground text-xs font-medium">
          Not indexed
        </div>
        <button
          onClick={onAction}
          className="text-xs font-medium text-foreground hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1 relative z-20"
        >
          Index repository
        </button>
      </motion.div>
    );
  }

  if (!hasActiveVersion && isInProgress) {
    return (
      <motion.div
        key="in-progress"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border text-muted-foreground text-xs font-medium relative overflow-hidden"
      >
        <RefreshCw size={12} className="animate-spin" />
        {status}
        <div className="absolute bottom-0 left-0 h-[2px] bg-foreground/20 w-full animate-progress-line origin-left" />
      </motion.div>
    );
  }

  if (!hasActiveVersion && isFailed) {
    return (
      <motion.div
        key="failed"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-3"
      >
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-red-500/80 text-xs font-medium border border-red-500/20 bg-red-500/5">
          <AlertCircle size={12} />
          Failed
        </div>
        <span className="text-xs text-muted-foreground">Indexing failed</span>
        <button
          onClick={onAction}
          className="text-xs font-medium text-foreground hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1 relative z-20"
        >
          Retry indexing
        </button>
      </motion.div>
    );
  }

  if (hasActiveVersion) {
    return (
      <motion.div
        key="ready"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-end gap-1"
      >
        <div className="flex items-center gap-2">
          {isInProgress && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              Updating…
            </span>
          )}
          {isFailed && (
             <span className="text-xs text-muted-foreground">
               Last update failed
             </span>
          )}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent-soft text-accent border border-accent-border text-xs font-medium relative overflow-hidden">
            <CheckCircle2 size={12} />
            Ready
            {isInProgress && (
              <div className="absolute bottom-0 left-0 h-[2px] bg-accent/40 w-full animate-progress-line origin-left" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
          <span>{repo.active_version_short_sha}</span>
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

function RowStatus({ repo, onAction }: { repo: RepositoryListItemOut, onAction: (e: React.MouseEvent) => void }) {
  return (
    <div aria-live="polite" className="relative flex items-center justify-end min-h-[32px] min-w-[200px]">
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
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(queryQ);
  const [analyzeRepo, setAnalyzeRepo] = useState<RepositoryListItemOut | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const limit = 50;

  // Feature flags
  const conversationsFlag = false;

  useEffect(() => {
    async function checkAuth() {
      try {
        const u = await api.getCurrentUser();
        setUser(u);
      } catch (e) {
        const err = e as { code?: string; status?: number; message?: string };
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
    } catch (e) {
      const err = e as { code?: string; status?: number; message?: string };
      if (err.code === 'UNAUTHENTICATED' || err.status === 401) {
        router.push('/?error=session_expired');
      } else {
        setError(err.message || 'Failed to load repositories');
      }
    } finally {
      setLoading(false);
    }
  }, [authLoading, router]);

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

  // Polling logic
  const pollStartTime = useRef<number | null>(null);

  const inProgress = ['QUEUED', 'FETCHING', 'INDEXING', 'ANALYZING'];
  const pollingActive = repositories.some(r => r.latest_job_status && inProgress.includes(r.latest_job_status));

  useEffect(() => {
    if (!pollingActive) {
      pollStartTime.current = null;
    } else if (pollStartTime.current === null) {
      pollStartTime.current = Date.now();
    }
  }, [pollingActive]);

  useEffect(() => {
    if (!pollingActive) return;

    let timeoutId: NodeJS.Timeout;
    let isMounted = true;
    let isFetching = false;

    const poll = async () => {
      if (!isMounted) return;
      if (document.hidden) {
        timeoutId = setTimeout(poll, 4000);
        return;
      }
      if (isFetching) return;

      try {
        isFetching = true;
        const data = await api.listRepositories(page, limit, search);
        if (isMounted) {
          setRepositories(data.items);
          setTotal(data.total);
          setHasMore(data.has_more);
        }
      } catch (e) {
         // silently handle errors, 429 will just backoff naturally

      } finally {
        isFetching = false;
        if (isMounted) {
           const elapsed = Date.now() - (pollStartTime.current || Date.now());
           const interval = elapsed > 60000 ? 10000 : 4000;
           timeoutId = setTimeout(poll, interval);
        }
      }
    };

    timeoutId = setTimeout(poll, 4000);

    const handleVisibilityChange = () => {
       if (!document.hidden && isMounted && !isFetching) {
          clearTimeout(timeoutId);
          poll();
       }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pollingActive, page, search, limit]);

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
    // Cast to list item, new fields will be null
    const newRepo: RepositoryListItemOut = { ...repo, latest_job_status: null, latest_job_failure_code: null, active_version_short_sha: null, last_indexed_at: null };
    setRepositories(prev => [newRepo, ...prev]);
    // Immediately fetch to ensure consistency
    setPage(1);
    loadRepositories(1, search);
    // Optionally trigger a full revalidate here
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
        <div className="mb-6 bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-md text-sm">
          {error}
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
