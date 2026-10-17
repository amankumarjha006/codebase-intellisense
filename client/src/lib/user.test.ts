import { describe, it, expect } from 'vitest';
import { deriveUserDisplay } from './user';

describe('deriveUserDisplay', () => {
  it('derives from full_name and github identity', () => {
    const user = {
      id: '123',
      email: 'jane@example.com',
      full_name: 'Jane Doe',
      github: {
        username: 'janedoe',
        github_user_id: '987',
      },
    };
    const res = deriveUserDisplay(user);
    expect(res.name).toBe('Jane Doe');
    expect(res.username).toBe('janedoe');
    expect(res.initials).toBe('JD');
  });

  it('handles single word full name', () => {
    const user = {
      id: '123',
      email: 'alice@example.com',
      full_name: 'Alice',
      github: null,
    };
    const res = deriveUserDisplay(user);
    expect(res.name).toBe('Alice');
    expect(res.initials).toBe('AL');
  });

  it('falls back to github username when full_name is null', () => {
    const user = {
      id: '123',
      email: 'dev@example.com',
      full_name: null,
      github: {
        username: 'octocat',
        github_user_id: '1',
      },
    };
    const res = deriveUserDisplay(user);
    expect(res.name).toBe('octocat');
    expect(res.username).toBe('octocat');
    expect(res.initials).toBe('OC');
  });

  it('handles empty/null gracefully', () => {
    const res = deriveUserDisplay(null);
    expect(res.name).toBe('User');
    expect(res.initials).toBe('U');
  });
});
