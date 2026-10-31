import * as React from 'react';

export const PINNED_REPOS_STORAGE_KEY = 'codebase_pinned_repos';
export const PINNED_REPOS_EVENT = 'codebase-pinned-repos-changed';

/**
 * Retrieve list of pinned repository IDs from localStorage.
 * Returns null if never initialized, or string[] if set.
 */
export function getStoredPinnedRepoIds(): string[] | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(PINNED_REPOS_STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Returns current pinned repository IDs (empty array if none stored).
 */
export function getPinnedRepoIds(): string[] {
  return getStoredPinnedRepoIds() || [];
}

/**
 * Save pinned repo IDs to localStorage and dispatch update event.
 */
function savePinnedRepoIds(ids: string[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PINNED_REPOS_STORAGE_KEY, JSON.stringify(ids));
    }
    if (typeof window !== 'undefined') {
      const event =
        typeof CustomEvent !== 'undefined'
          ? new CustomEvent(PINNED_REPOS_EVENT, { detail: ids })
          : { type: PINNED_REPOS_EVENT };
      window.dispatchEvent(event as Event);
    }
  } catch (err) {
    console.error('Failed to save pinned repositories:', err);
  }
}

/**
 * Check if a repository is currently pinned.
 */
export function isRepoPinned(repoId: string): boolean {
  return getPinnedRepoIds().includes(repoId);
}

/**
 * Pin a repository to the sidebar.
 */
export function pinRepo(repoId: string): void {
  const current = getPinnedRepoIds();
  if (!current.includes(repoId)) {
    savePinnedRepoIds([...current, repoId]);
  }
}

/**
 * Unpin a repository from the sidebar.
 */
export function unpinRepo(repoId: string): void {
  const current = getPinnedRepoIds();
  if (current.includes(repoId)) {
    savePinnedRepoIds(current.filter((id) => id !== repoId));
  }
}

/**
 * Toggle pin status for a repository. Returns new pinned state.
 */
export function togglePinRepo(repoId: string): boolean {
  const current = getPinnedRepoIds();
  const willBePinned = !current.includes(repoId);
  if (willBePinned) {
    savePinnedRepoIds([...current, repoId]);
  } else {
    savePinnedRepoIds(current.filter((id) => id !== repoId));
  }
  return willBePinned;
}

/**
 * Initialize pinned repositories with fallback IDs if localStorage is empty.
 */
export function initializePinnedReposIfEmpty(fallbackIds: string[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (localStorage.getItem(PINNED_REPOS_STORAGE_KEY) === null && fallbackIds.length > 0) {
        savePinnedRepoIds(fallbackIds);
      }
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * React hook to observe and modify pinned repositories with instant reactivity.
 */
export function usePinnedRepos() {
  const [pinnedIds, setPinnedIds] = React.useState<string[]>(() => getPinnedRepoIds());

  React.useEffect(() => {
    const handleUpdate = () => {
      setPinnedIds(getPinnedRepoIds());
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(PINNED_REPOS_EVENT, handleUpdate);
      window.addEventListener('storage', handleUpdate);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(PINNED_REPOS_EVENT, handleUpdate);
        window.removeEventListener('storage', handleUpdate);
      }
    };
  }, []);

  const isPinned = React.useCallback(
    (repoId: string) => pinnedIds.includes(repoId),
    [pinnedIds]
  );

  const pin = React.useCallback((repoId: string) => {
    pinRepo(repoId);
  }, []);

  const unpin = React.useCallback((repoId: string) => {
    unpinRepo(repoId);
  }, []);

  const togglePin = React.useCallback((repoId: string) => {
    return togglePinRepo(repoId);
  }, []);

  const initIfEmpty = React.useCallback((fallbackIds: string[]) => {
    initializePinnedReposIfEmpty(fallbackIds);
  }, []);

  return {
    pinnedIds,
    isPinned,
    pin,
    unpin,
    togglePin,
    initIfEmpty,
  };
}
