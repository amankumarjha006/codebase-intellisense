import { QueryClient } from '@tanstack/react-query';
import { API_URL, ApiError } from './api';

let sessionExpiredCallback: (() => void) | null = null;
let inFlightAuthCheck: Promise<boolean> | null = null;

export function registerSessionExpiredHandler(cb: () => void) {
  sessionExpiredCallback = cb;
}

/**
 * Single-flight deduplicated check to verify if the session is truly dead.
 * Deduplicates concurrent 401s so only one request hits /auth/me.
 */
export async function verifyAuthSession(): Promise<boolean> {
  if (inFlightAuthCheck) {
    return inFlightAuthCheck;
  }

  inFlightAuthCheck = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (res.status === 401) {
        sessionExpiredCallback?.();
        return false;
      }
      return res.ok;
    } catch {
      sessionExpiredCallback?.();
      return false;
    } finally {
      inFlightAuthCheck = null;
    }
  })();

  return inFlightAuthCheck;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry 401, 403, 404, or validation errors
        if (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status === 404)) {
          if (error.status === 401) {
            verifyAuthSession();
          }
          return false;
        }
        // Max 1 retry for transient network drops
        return failureCount < 1;
      },
    },
    mutations: {
      // NEVER auto-retry mutations (analyze, stream, delete, etc.)
      retry: false,
      onError: (error) => {
        if (error instanceof ApiError && error.status === 401) {
          verifyAuthSession();
        }
      },
    },
  },
});
