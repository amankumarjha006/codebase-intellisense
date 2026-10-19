export type AuthErrorKind = 'unauthenticated' | 'unreachable' | 'other';

/**
 * Classifies an authentication or API error:
 * - 401 status -> 'unauthenticated'
 * - no status (network error, TypeError, etc.) -> 'unreachable'
 * - other status (403, 404, 500, 503, etc.) -> 'other'
 */
export function classifyAuthError(err: unknown): AuthErrorKind {
  if (!err || typeof err !== 'object') {
    return 'unreachable';
  }

  const status = (err as { status?: unknown }).status;
  if (status === undefined || status === null) {
    return 'unreachable';
  }

  if (typeof status === 'number' && status === 401) {
    return 'unauthenticated';
  }

  return 'other';
}

/**
 * Builds the GitHub OAuth sign-in URL.
 */
export function buildSignInUrl(apiUrl: string): string {
  const sanitized = apiUrl.replace(/\/+$/, '');
  return `${sanitized}/auth/github`;
}
