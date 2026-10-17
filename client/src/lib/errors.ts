import type { ApiError } from './api';

/**
 * Maps an error (typically an ApiError) to safe, user-facing copy.
 * Never exposes err.message or raw server text to the UI.
 *
 * - No status (network error) → "Can't reach the server."
 * - 401 → handled by session flow (returns null to signal redirect)
 * - 403 → "You don't have access."
 * - 404 → "We couldn't find that."
 * - 429 → "Too many requests. Please wait a moment."
 * - 502/503 → "Temporarily unavailable. Please try again."
 * - Everything else → "Something went wrong. Please try again."
 */
export function mapErrorToCopy(err: unknown): string | null {
  const apiErr = err as Partial<ApiError> | undefined;
  const status = apiErr?.status;

  if (status === undefined || status === null) {
    return "Can't reach the server.";
  }

  switch (status) {
    case 401:
      // Signal to caller: use session-expired redirect instead of displaying copy
      return null;
    case 403:
      return "You don't have access.";
    case 404:
      return "We couldn't find that.";
    case 429:
      return "Too many requests. Please wait a moment.";
    case 502:
    case 503:
      return "Temporarily unavailable. Please try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/**
 * Allowlisted `?error=` query parameter values for the landing page.
 * Any value not in this map is silently ignored (never rendered).
 */
export const LANDING_ERROR_COPY: Record<string, string> = {
  session_expired: 'Your session has expired. Please sign in again.',
  login_failed: 'Login failed. Please try again.',
  access_denied: 'Access denied. You may not have permission.',
};
