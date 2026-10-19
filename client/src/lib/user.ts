import type { CurrentUser } from './api';

export interface UserDisplay {
  name: string;
  username: string;
  email: string;
  initials: string;
}

export function deriveUserDisplay(user: CurrentUser | null | undefined): UserDisplay {
  if (!user) {
    return {
      name: 'User',
      username: 'user',
      email: '',
      initials: 'U',
    };
  }

  const name = user.full_name || user.github?.username || user.email || 'User';
  const username = user.github?.username || user.email.split('@')[0] || 'user';
  const email = user.email || '';

  let initials = 'U';
  if (user.full_name) {
    const parts = user.full_name.trim().split(/\s+/);
    if (parts.length >= 2) {
      initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts[0]) {
      initials = parts[0].slice(0, 2).toUpperCase();
    }
  } else if (user.github?.username) {
    initials = user.github.username.slice(0, 2).toUpperCase();
  } else if (email) {
    initials = email.slice(0, 2).toUpperCase();
  }

  return { name, username, email, initials };
}
