import type { RepositoryListItemOut } from './api';

export type StatusCategory = 'READY' | 'INDEXING' | 'FAILED' | 'OTHER';

export function getRepositoryStatusCategory(repo: RepositoryListItemOut): StatusCategory {
  const status = (repo.latest_job_status || '').toUpperCase();
  if (status === 'READY' || (repo.active_version_short_sha && !repo.latest_job_status)) {
    return 'READY';
  }
  if (['INDEXING', 'QUEUED', 'FETCHING', 'ANALYZING', 'CLONING'].includes(status)) {
    return 'INDEXING';
  }
  if (status === 'FAILED') {
    return 'FAILED';
  }
  return 'OTHER';
}

/**
 * According to redesign specification:
 * Status filter ONLY appears when there are non-ready repos.
 */
export function shouldShowStatusFilter(repositories: RepositoryListItemOut[]): boolean {
  if (!repositories || repositories.length === 0) return false;
  return repositories.some((repo) => getRepositoryStatusCategory(repo) !== 'READY');
}

/**
 * Filter repositories by status category
 */
export function filterRepositoriesByStatus(
  repositories: RepositoryListItemOut[],
  filter: 'ALL' | 'READY' | 'INDEXING' | 'FAILED'
): RepositoryListItemOut[] {
  if (!repositories) return [];
  if (filter === 'ALL') return repositories;

  return repositories.filter((repo) => {
    const cat = getRepositoryStatusCategory(repo);
    return cat === filter;
  });
}

export interface ConversationDateMap {
  [repoId: string]: string; // ISO date string of latest conversation
}

/**
 * Select the hero repository for the "Continue" hero on Dashboard:
 * 1. Prioritize last-opened repo (from localStorage keyed by user id)
 * 2. If not found, prioritize repo with most recently updated conversation
 * 3. Fall back to first READY repository
 * 4. Fall back to first repository in list, or null
 */
export function selectHeroRepository(
  repositories: RepositoryListItemOut[],
  lastOpenedRepoId: string | null,
  conversationDates?: ConversationDateMap
): RepositoryListItemOut | null {
  if (!repositories || repositories.length === 0) return null;

  // 1. Last opened repository from localStorage
  if (lastOpenedRepoId) {
    const matched = repositories.find((r) => r.id === lastOpenedRepoId);
    if (matched) return matched;
  }

  // 2. Repo with the most recent conversation
  if (conversationDates && Object.keys(conversationDates).length > 0) {
    let newestRepo: RepositoryListItemOut | null = null;
    let newestTime = 0;

    for (const repo of repositories) {
      const convDate = conversationDates[repo.id];
      if (convDate) {
        const time = new Date(convDate).getTime();
        if (time > newestTime) {
          newestTime = time;
          newestRepo = repo;
        }
      }
    }
    if (newestRepo) return newestRepo;
  }

  // 3. First READY repository
  const firstReady = repositories.find((r) => getRepositoryStatusCategory(r) === 'READY');
  if (firstReady) return firstReady;

  // 4. Default to first in list
  return repositories[0];
}

/**
 * Save last-opened repository id keyed by user
 */
export function setLastOpenedRepoId(userId: string | null | undefined, repoId: string): void {
  try {
    const key = `codebase_last_opened_repo_${userId || 'anon'}`;
    localStorage.setItem(key, repoId);
  } catch {
    // localStorage might be unavailable in private browsing or iframe
  }
}

/**
 * Get last-opened repository id keyed by user
 */
export function getLastOpenedRepoId(userId: string | null | undefined): string | null {
  try {
    const key = `codebase_last_opened_repo_${userId || 'anon'}`;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

