import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { realApi } from './api';

export const INDEXING_QUERY_KEY = ['repositories', 'indexing-status'] as const;

const ACTIVE_JOB_STATUSES = new Set(['QUEUED', 'FETCHING', 'INDEXING', 'ANALYZING']);

/**
 * Shared indexing status hook used across TopBar progress chip, RepositoriesTable, and Dashboard.
 * - One shared cache key
 * - Polls ONLY while a job is active
 * - Exponential backoff: 2s -> 4s -> 8s -> 15s max
 * - Pauses polling when document is hidden
 * - Resets backoff when a new job is triggered
 */
export function useIndexingStatus() {
  const queryClient = useQueryClient();
  const [backoffMs, setBackoffMs] = React.useState<number>(2000);

  const query = useQuery({
    queryKey: INDEXING_QUERY_KEY,
    queryFn: async () => {
      const res = await realApi.listRepositories(1, 100);
      return res.items || [];
    },
    refetchInterval: (queryState) => {
      // Pause if tab is hidden in background
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return false;
      }

      const repos = queryState.state.data || [];
      const hasActiveJob = repos.some((r) => r.latest_job_status && ACTIVE_JOB_STATUSES.has(r.latest_job_status));

      if (!hasActiveJob) {
        return false;
      }

      return backoffMs;
    },
  });

  const repositories = query.data || [];
  const activeJobRepo = repositories.find(
    (r) => r.latest_job_status && ACTIVE_JOB_STATUSES.has(r.latest_job_status)
  ) || null;

  // Exponentially increase backoff if still polling
  React.useEffect(() => {
    if (!activeJobRepo) {
      setBackoffMs(2000);
      return;
    }

    const timer = setTimeout(() => {
      setBackoffMs((prev) => Math.min(prev * 2, 15000));
    }, backoffMs);

    return () => clearTimeout(timer);
  }, [activeJobRepo, backoffMs, query.dataUpdatedAt]);

  const resetBackoff = React.useCallback(() => {
    setBackoffMs(2000);
    queryClient.invalidateQueries({ queryKey: INDEXING_QUERY_KEY });
  }, [queryClient]);

  return {
    repositories,
    activeJobRepo,
    isIndexing: Boolean(activeJobRepo),
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    resetBackoff,
  };
}
