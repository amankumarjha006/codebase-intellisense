import { describe, it, expect, beforeEach } from 'vitest';
import {
  PINNED_REPOS_STORAGE_KEY,
  getPinnedRepoIds,
  pinRepo,
  unpinRepo,
  togglePinRepo,
  isRepoPinned,
  initializePinnedReposIfEmpty,
} from './pinnedRepos';

const store = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, val: string) => store.set(key, val),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
};

// Polyfill globals for test environment
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = mockLocalStorage as unknown as Storage;
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as Window & typeof globalThis;
}

describe('pinnedRepos utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with empty list when no key in localStorage', () => {
    expect(getPinnedRepoIds()).toEqual([]);
    expect(isRepoPinned('repo-1')).toBe(false);
  });

  it('pins a repository and saves to localStorage', () => {
    pinRepo('repo-1');
    expect(getPinnedRepoIds()).toEqual(['repo-1']);
    expect(isRepoPinned('repo-1')).toBe(true);

    // Duplicate pin should not add twice
    pinRepo('repo-1');
    expect(getPinnedRepoIds()).toEqual(['repo-1']);
  });

  it('unpins a repository', () => {
    pinRepo('repo-1');
    pinRepo('repo-2');
    expect(getPinnedRepoIds()).toEqual(['repo-1', 'repo-2']);

    unpinRepo('repo-1');
    expect(getPinnedRepoIds()).toEqual(['repo-2']);
    expect(isRepoPinned('repo-1')).toBe(false);
    expect(isRepoPinned('repo-2')).toBe(true);
  });

  it('toggles pin status correctly', () => {
    const pinned = togglePinRepo('repo-1');
    expect(pinned).toBe(true);
    expect(isRepoPinned('repo-1')).toBe(true);

    const unpinned = togglePinRepo('repo-1');
    expect(unpinned).toBe(false);
    expect(isRepoPinned('repo-1')).toBe(false);
  });

  it('initializes fallback IDs if localStorage is empty', () => {
    initializePinnedReposIfEmpty(['repo-1', 'repo-2']);
    expect(getPinnedRepoIds()).toEqual(['repo-1', 'repo-2']);

    // Calling again does not overwrite existing list
    localStorage.setItem(PINNED_REPOS_STORAGE_KEY, JSON.stringify(['repo-3']));
    initializePinnedReposIfEmpty(['repo-1', 'repo-2']);
    expect(getPinnedRepoIds()).toEqual(['repo-3']);
  });
});
