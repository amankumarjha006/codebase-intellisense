import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind conflict resolution.
 * Wraps clsx + tailwind-merge for conditional classes.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a relative timestamp like "2 hours ago", "3 days ago", "Yesterday".
 */
export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Truncate a SHA to 7 characters (standard short form).
 */
export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

/**
 * Format a number with commas: 14290 → "14,290"
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Friendly label for indexing failure codes.
 */
export function friendlyFailureMessage(code: string | null): string {
  if (!code) return 'An unknown error occurred.';

  const messages: Record<string, string> = {
    CLONE_FAILED: 'We couldn\'t clone the repository. Check that it exists and that access is granted.',
    REPOSITORY_TOO_LARGE: 'This repository exceeds the maximum size for indexing.',
    EMBEDDING_PROVIDER_RATE_LIMITED: 'Our AI provider is busy. Wait a minute, then retry.',
    EMBEDDING_PROVIDER_UNAVAILABLE: 'The embedding service is temporarily unavailable. Please try again shortly.',
    EMBEDDING_PROVIDER_AUTH: 'There\'s an issue with the embedding service authentication. Please contact support.',
    INTERNAL_ERROR: 'An internal error occurred during indexing. Please retry.',
  };

  return messages[code] ?? 'An unexpected error occurred. Please retry.';
}

/**
 * Sleep utility for mock delays.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random hex string (for mock IDs).
 */
export function randomHex(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}
