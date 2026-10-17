import { describe, it, expect } from 'vitest';
import { parseRetryAfter, MAX_RETRY_AFTER_SECONDS } from './retryAfter';

describe('parseRetryAfter', () => {
  it('returns undefined for empty, null, or invalid input', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter(undefined)).toBeUndefined();
    expect(parseRetryAfter('')).toBeUndefined();
    expect(parseRetryAfter('invalid-seconds')).toBeUndefined();
    expect(parseRetryAfter('-10')).toBeUndefined();
  });

  it('parses valid integer seconds', () => {
    expect(parseRetryAfter('30')).toBe(30);
    expect(parseRetryAfter(' 45 ')).toBe(45);
    expect(parseRetryAfter('1')).toBe(1);
  });

  it('caps values above MAX_RETRY_AFTER_SECONDS (120s)', () => {
    expect(parseRetryAfter('300')).toBe(MAX_RETRY_AFTER_SECONDS);
    expect(parseRetryAfter('99999')).toBe(MAX_RETRY_AFTER_SECONDS);
  });

  it('parses HTTP-date and caps at MAX_RETRY_AFTER_SECONDS', () => {
    const futureDate = new Date(Date.now() + 60 * 1000).toUTCString();
    const result = parseRetryAfter(futureDate);
    expect(result).toBeDefined();
    expect(result).toBeGreaterThanOrEqual(58);
    expect(result).toBeLessThanOrEqual(62);

    const farFutureDate = new Date(Date.now() + 600 * 1000).toUTCString();
    expect(parseRetryAfter(farFutureDate)).toBe(MAX_RETRY_AFTER_SECONDS);
  });
});
