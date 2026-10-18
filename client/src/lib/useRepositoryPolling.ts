import * as React from 'react';
import { realApi, ApiError, RepositoryListItemOut, RepositoryListOut } from './api';
import { hasActiveJob, computeNextPollDelay } from './polling';

export interface UseRepositoryPollingOptions {
  page?: number;
  limit?: number;
  search?: string;
  onSessionExpired?: () => void;
}

export interface UseRepositoryPollingResult {
  repositories: RepositoryListItemOut[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  loading: boolean;
  isPolling: boolean;
  error: ApiError | Error | null;
  refetch: () => Promise<void>;
  triggerIndex: (repositoryId: string, branch?: string) => Promise<void>;
  deleteRepository: (repositoryId: string) => Promise<void>;
}

export function useRepositoryPolling({
  page = 1,
  limit = 20,
  search = '',
  onSessionExpired,
}: UseRepositoryPollingOptions = {}): UseRepositoryPollingResult {
  const [repositories, setRepositories] = React.useState<RepositoryListItemOut[]>([]);
  const [total, setTotal] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [isPolling, setIsPolling] = React.useState(false);
  const [error, setError] = React.useState<ApiError | Error | null>(null);

  // Active duration tracking for backing off from 4s to 10s after 60s
  const activeSinceRef = React.useRef<number | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const isRequestInProgressRef = React.useRef(false);
  const isMountedRef = React.useRef(true);
  const currentRequestIdRef = React.useRef(0);

  // Stable references for dependencies
  const repositoriesRef = React.useRef<RepositoryListItemOut[]>(repositories);
  repositoriesRef.current = repositories;

  const pageRef = React.useRef(page);
  pageRef.current = page;
  const limitRef = React.useRef(limit);
  limitRef.current = limit;
  const searchRef = React.useRef(search);
  searchRef.current = search;
  const onSessionExpiredRef = React.useRef(onSessionExpired);
  onSessionExpiredRef.current = onSessionExpired;

  const scheduleNextPollRef = React.useRef<(delayMs: number) => void>(() => {});

  const clearTimer = React.useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const fetchRepositories = React.useCallback(
    async (isBackgroundPoll = false): Promise<RepositoryListOut | null> => {
      // Prevent overlapping background polls
      if (isBackgroundPoll && isRequestInProgressRef.current) {
        return null;
      }

      // If a foreground fetch is triggered while a request is in progress, abort the prior request
      if (!isBackgroundPoll && abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const requestId = ++currentRequestIdRef.current;
      const controller = new AbortController();
      abortControllerRef.current = controller;
      isRequestInProgressRef.current = true;

      if (!isBackgroundPoll) {
        setLoading(true);
        setError(null);
      }

      try {
        const data = await realApi.listRepositories(
          pageRef.current,
          limitRef.current,
          searchRef.current,
          { signal: controller.signal }
        );

        if (!isMountedRef.current || requestId !== currentRequestIdRef.current) {
          return null;
        }

        setRepositories(data.items);
        setTotal(data.total);
        setHasMore(data.has_more);
        setError(null);
        return data;
      } catch (err: unknown) {
        if (!isMountedRef.current || requestId !== currentRequestIdRef.current) {
          return null;
        }

        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }

        if (err instanceof ApiError) {
          if (err.status === 401) {
            clearTimer();
            setIsPolling(false);
            if (onSessionExpiredRef.current) {
              onSessionExpiredRef.current();
            }
            return null;
          }
          if (err.status === 404) {
            clearTimer();
            setIsPolling(false);
            setError(err);
            return null;
          }
        }

        // Only set page-level error if this wasn't a background polling hiccup
        if (!isBackgroundPoll) {
          if (err instanceof Error) {
            setError(err);
          }
        }
        return null;
      } finally {
        if (requestId === currentRequestIdRef.current) {
          isRequestInProgressRef.current = false;
          if (isMountedRef.current && !isBackgroundPoll) {
            setLoading(false);
          }
        }
      }
    },
    [clearTimer]
  );

  // The recursive poll scheduler
  const scheduleNextPoll = React.useCallback(
    (delayMs: number) => {
      clearTimer();
      if (!isMountedRef.current) return;

      setIsPolling(true);
      timerRef.current = setTimeout(async () => {
        if (!isMountedRef.current) return;

        // Pause when tab is hidden
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          return;
        }

        let retryAfter: number | undefined;
        let result: RepositoryListOut | null = null;

        try {
          result = await fetchRepositories(true);
        } catch (err: unknown) {
          if (err instanceof ApiError && err.retryAfter) {
            retryAfter = err.retryAfter;
          }
        }

        if (!isMountedRef.current) return;

        const items = result ? result.items : repositoriesRef.current;
        const active = hasActiveJob(items);

        if (active) {
          if (activeSinceRef.current === null) {
            activeSinceRef.current = Date.now();
          }
        } else {
          activeSinceRef.current = null;
        }

        const elapsed = activeSinceRef.current !== null ? Date.now() - activeSinceRef.current : 0;
        const nextDelay = computeNextPollDelay(active, elapsed, retryAfter);

        if (nextDelay !== null) {
          scheduleNextPollRef.current(nextDelay);
        } else {
          setIsPolling(false);
        }
      }, delayMs);
    },
    [clearTimer, fetchRepositories]
  );
  scheduleNextPollRef.current = scheduleNextPoll;

  // Trigger manual or initial fetch
  const refetch = React.useCallback(async () => {
    try {
      const data = await fetchRepositories(false);
      if (data && hasActiveJob(data.items)) {
        activeSinceRef.current = Date.now();
        scheduleNextPoll(4000);
      } else {
        activeSinceRef.current = null;
        clearTimer();
        setIsPolling(false);
      }
    } catch {
      // Error is set inside fetchRepositories
    }
  }, [fetchRepositories, scheduleNextPoll, clearTimer]);

  // Initial fetch and handle parameter changes (search, page)
  React.useEffect(() => {
    refetch();
  }, [page, limit, search, refetch]);

  // Handle visibility changes: pause on hide, resume & refetch on visible
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;

      if (document.visibilityState === 'visible') {
        // Tab became visible again; immediately pull fresh state from DB
        refetch();
      } else {
        // Tab hidden; pause polling timer
        clearTimer();
        setIsPolling(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [scheduleNextPoll, clearTimer]);

  // Cleanup on unmount
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearTimer();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [clearTimer]);

  // Trigger indexing for a repository
  const triggerIndex = React.useCallback(
    async (repositoryId: string, branch?: string) => {
      await realApi.analyzeRepository(repositoryId, branch || null);
      // Immediately start polling with 4s loop
      activeSinceRef.current = Date.now();
      await fetchRepositories(true);
      scheduleNextPoll(4000);
    },
    [fetchRepositories, scheduleNextPoll]
  );

  // Delete a repository and update local state
  const deleteRepository = React.useCallback(
    async (repositoryId: string) => {
      await realApi.deleteRepository(repositoryId);
      setRepositories((prev) => prev.filter((r) => r.id !== repositoryId));
      setTotal((prev) => Math.max(0, prev - 1));
    },
    []
  );

  return {
    repositories,
    total,
    page,
    limit,
    hasMore,
    loading,
    isPolling,
    error,
    refetch,
    triggerIndex,
    deleteRepository,
  };
}
