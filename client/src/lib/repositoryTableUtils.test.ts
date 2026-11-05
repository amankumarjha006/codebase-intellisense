import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  getRepositoryStatusCategory,
  shouldShowStatusFilter,
  filterRepositoriesByStatus,
  selectHeroRepository,
  getLastOpenedRepoId,
  setLastOpenedRepoId,
} from './repositoryTableUtils';
import type { RepositoryListItemOut } from './api';

const mockRepos: RepositoryListItemOut[] = [
  {
    id: 'repo-1',
    owner: 'fastapi',
    name: 'fastapi',
    is_private: false,
    created_at: '2026-01-01T00:00:00Z',
    latest_job_status: 'READY',
    latest_job_failure_code: null,
    active_version_short_sha: 'a1b2c3d',
    last_indexed_at: '2026-01-10T12:00:00Z',
  },
  {
    id: 'repo-2',
    owner: 'octocat',
    name: 'Spoon-Knife',
    is_private: true,
    created_at: '2026-01-02T00:00:00Z',
    latest_job_status: 'INDEXING',
    latest_job_failure_code: null,
    active_version_short_sha: null,
    last_indexed_at: null,
  },
  {
    id: 'repo-3',
    owner: 'org',
    name: 'broken-repo',
    is_private: false,
    created_at: '2026-01-03T00:00:00Z',
    latest_job_status: 'FAILED',
    latest_job_failure_code: 'CLONE_FAILED',
    active_version_short_sha: null,
    last_indexed_at: null,
  },
];

describe('repositoryTableUtils', () => {
  let storageMap: Record<string, string> = {};

  beforeAll(() => {
    // Mock localStorage for node environment
    const mockStorage = {
      getItem: (key: string) => storageMap[key] || null,
      setItem: (key: string, value: string) => {
        storageMap[key] = value;
      },
      removeItem: (key: string) => {
        delete storageMap[key];
      },
      clear: () => {
        storageMap = {};
      },
      get length() {
        return Object.keys(storageMap).length;
      },
      key: (i: number) => Object.keys(storageMap)[i] || null,
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
    });
  });

  beforeEach(() => {
    storageMap = {};
  });

  describe('getRepositoryStatusCategory', () => {
    it('identifies READY status', () => {
      expect(getRepositoryStatusCategory(mockRepos[0])).toBe('READY');
      expect(
        getRepositoryStatusCategory({
          ...mockRepos[0],
          latest_job_status: null,
          active_version_short_sha: 'xyz',
        })
      ).toBe('READY');
    });

    it('identifies INDEXING/in-progress statuses', () => {
      expect(getRepositoryStatusCategory(mockRepos[1])).toBe('INDEXING');
      expect(
        getRepositoryStatusCategory({ ...mockRepos[1], latest_job_status: 'QUEUED' })
      ).toBe('INDEXING');
      expect(
        getRepositoryStatusCategory({ ...mockRepos[1], latest_job_status: 'ANALYZING' })
      ).toBe('INDEXING');
    });

    it('identifies FAILED status', () => {
      expect(getRepositoryStatusCategory(mockRepos[2])).toBe('FAILED');
    });
  });

  describe('shouldShowStatusFilter', () => {
    it('returns false when all repositories are ready', () => {
      const allReady = [mockRepos[0], { ...mockRepos[0], id: 'repo-ready-2' }];
      expect(shouldShowStatusFilter(allReady)).toBe(false);
    });

    it('returns true when at least one repository is indexing or failed', () => {
      expect(shouldShowStatusFilter(mockRepos)).toBe(true);
      expect(shouldShowStatusFilter([mockRepos[0], mockRepos[1]])).toBe(true);
      expect(shouldShowStatusFilter([mockRepos[0], mockRepos[2]])).toBe(true);
    });

    it('returns false for empty repositories array', () => {
      expect(shouldShowStatusFilter([])).toBe(false);
    });
  });

  describe('filterRepositoriesByStatus', () => {
    it('filters correctly by category', () => {
      expect(filterRepositoriesByStatus(mockRepos, 'ALL')).toHaveLength(3);
      expect(filterRepositoriesByStatus(mockRepos, 'READY')).toEqual([mockRepos[0]]);
      expect(filterRepositoriesByStatus(mockRepos, 'INDEXING')).toEqual([mockRepos[1]]);
      expect(filterRepositoriesByStatus(mockRepos, 'FAILED')).toEqual([mockRepos[2]]);
    });
  });

  describe('selectHeroRepository', () => {
    it('prioritizes last-opened repo from localStorage', () => {
      setLastOpenedRepoId('user1', 'repo-2');
      const selected = selectHeroRepository(mockRepos, getLastOpenedRepoId('user1'));
      expect(selected?.id).toBe('repo-2');
    });

    it('prioritizes repo with newest conversation if last-opened is not available', () => {
      const dates = {
        'repo-1': '2026-02-01T00:00:00Z',
        'repo-2': '2026-03-01T00:00:00Z', // newest
      };
      const selected = selectHeroRepository(mockRepos, null, dates);
      expect(selected?.id).toBe('repo-2');
    });

    it('falls back to first READY repository if no conversation dates or last-opened', () => {
      const selected = selectHeroRepository(mockRepos, null);
      expect(selected?.id).toBe('repo-1');
    });

    it('falls back to first repository if none are ready', () => {
      const nonReady = [mockRepos[1], mockRepos[2]];
      const selected = selectHeroRepository(nonReady, null);
      expect(selected?.id).toBe('repo-2');
    });

    it('returns null for empty repo list', () => {
      expect(selectHeroRepository([], null)).toBeNull();
    });
  });
});
