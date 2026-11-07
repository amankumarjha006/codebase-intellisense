import { lazy, ComponentType } from 'react';

/**
 * Wraps dynamic React.lazy imports with a single-shot auto-reload retry.
 * Handles Vite dev-server restarts and stale production chunk hashes seamlessly.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const storageKey = 'vite_chunk_reload';
    try {
      const module = await factory();
      window.sessionStorage.removeItem(storageKey);
      return module;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      const isChunkError =
        msg.includes('Failed to fetch dynamically imported module') ||
        (error instanceof Error && error.name === 'ChunkLoadError');

      if (isChunkError && !window.sessionStorage.getItem(storageKey)) {
        window.sessionStorage.setItem(storageKey, 'true');
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }

      window.sessionStorage.removeItem(storageKey);
      throw error;
    }
  });
}

