import { describe, it, expect } from 'vitest';
import { ApiError } from './api';
import { classifyAuthError, buildSignInUrl } from './auth';

describe('classifyAuthError', () => {
  it('classifies 401 as unauthenticated', () => {
    const apiErr = new ApiError('Unauthorized', 'UNAUTHENTICATED', 401);
    expect(classifyAuthError(apiErr)).toBe('unauthenticated');

    const objErr = { status: 401, message: 'Invalid token' };
    expect(classifyAuthError(objErr)).toBe('unauthenticated');
  });

  it('classifies missing status / network errors as unreachable', () => {
    const networkErr = new Error('Failed to fetch');
    expect(classifyAuthError(networkErr)).toBe('unreachable');

    expect(classifyAuthError(null)).toBe('unreachable');
    expect(classifyAuthError(undefined)).toBe('unreachable');
    expect(classifyAuthError('Network error')).toBe('unreachable');
    expect(classifyAuthError({})).toBe('unreachable');
    expect(classifyAuthError({ status: undefined })).toBe('unreachable');
  });

  it('classifies other HTTP statuses as other', () => {
    expect(classifyAuthError(new ApiError('Forbidden', 'FORBIDDEN', 403))).toBe('other');
    expect(classifyAuthError(new ApiError('Not found', 'NOT_FOUND', 404))).toBe('other');
    expect(classifyAuthError(new ApiError('Internal error', 'INTERNAL_SERVER_ERROR', 500))).toBe('other');
    expect(classifyAuthError(new ApiError('Service unavailable', 'SERVICE_UNAVAILABLE', 503))).toBe('other');
    expect(classifyAuthError({ status: 502 })).toBe('other');
  });
});

describe('buildSignInUrl', () => {
  it('returns ${apiUrl}/auth/github for standard URL', () => {
    expect(buildSignInUrl('http://localhost:8000/api/v1')).toBe('http://localhost:8000/api/v1/auth/github');
  });

  it('handles trailing slashes cleanly', () => {
    expect(buildSignInUrl('http://localhost:8000/api/v1/')).toBe('http://localhost:8000/api/v1/auth/github');
    expect(buildSignInUrl('https://api.example.com///')).toBe('https://api.example.com/auth/github');
  });
});
