import { describe, it, expect } from 'vitest';
import { mapErrorToCopy, LANDING_ERROR_COPY } from './errors';
import { ApiError } from './api';

describe('mapErrorToCopy', () => {
  it('maps network errors (no status) to safe copy', () => {
    expect(mapErrorToCopy(new Error('Network failure'))).toBe("Can't reach the server.");
    expect(mapErrorToCopy({})).toBe("Can't reach the server.");
  });

  it('returns null for 401 to trigger session flow', () => {
    const err = new ApiError('Unauthorized', 'UNAUTHENTICATED', 401);
    expect(mapErrorToCopy(err)).toBeNull();
  });

  it('maps 403 to safe access copy', () => {
    const err = new ApiError('Forbidden', 'UNAUTHORIZED_ACCESS', 403);
    expect(mapErrorToCopy(err)).toBe("You don't have access.");
  });

  it('maps 404 to not found copy', () => {
    const err = new ApiError('Not found', 'NOT_FOUND', 404);
    expect(mapErrorToCopy(err)).toBe("We couldn't find that.");
  });

  it('maps 429 to rate limit copy', () => {
    const err = new ApiError('Too many', 'RATE_LIMIT_EXCEEDED', 429);
    expect(mapErrorToCopy(err)).toBe('Too many requests. Please wait a moment.');
  });

  it('maps 502 and 503 to unavailable copy', () => {
    expect(mapErrorToCopy(new ApiError('Bad gateway', 'GITHUB_API_ERROR', 502))).toBe(
      'Temporarily unavailable. Please try again.'
    );
    expect(mapErrorToCopy(new ApiError('Service unavailable', 'AI_SERVICE_UNAVAILABLE', 503))).toBe(
      'Temporarily unavailable. Please try again.'
    );
  });

  it('maps unexpected status to generic error copy', () => {
    expect(mapErrorToCopy(new ApiError('Internal crash with stack trace', 'INTERNAL_ERROR', 500))).toBe(
      'Something went wrong. Please try again.'
    );
  });
});

describe('LANDING_ERROR_COPY allowlist', () => {
  it('contains expected allowlisted error keys', () => {
    expect(LANDING_ERROR_COPY['session_expired']).toBe('Your session has expired. Please sign in again.');
    expect(LANDING_ERROR_COPY['login_failed']).toBe('Login failed. Please try again.');
    expect(LANDING_ERROR_COPY['access_denied']).toBe('Access denied. You may not have permission.');
  });

  it('does not define unallowlisted keys', () => {
    expect(LANDING_ERROR_COPY['arbitrary_server_leak']).toBeUndefined();
  });
});
