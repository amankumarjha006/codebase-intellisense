/** Maximum Retry-After value we honour (seconds). */
export const MAX_RETRY_AFTER_SECONDS = 120;

/**
 * Parse a Retry-After header value.
 * Accepts either an integer (seconds) or an HTTP-date string.
 * Returns seconds, capped at MAX_RETRY_AFTER_SECONDS, or undefined.
 */
export function parseRetryAfter(header: string | null | undefined): number | undefined {
  if (!header) return undefined;

  const trimmed = header.trim();
  if (!trimmed) return undefined;

  // Try integer seconds first
  const parsed = parseInt(trimmed, 10);
  if (!isNaN(parsed) && String(parsed) === trimmed && parsed > 0) {
    return Math.min(parsed, MAX_RETRY_AFTER_SECONDS);
  }

  // Try HTTP-date
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    const seconds = Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));
    return seconds > 0 ? Math.min(seconds, MAX_RETRY_AFTER_SECONDS) : undefined;
  }

  return undefined;
}
