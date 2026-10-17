export const IN_PROGRESS_JOB_STATUSES = [
  'QUEUED',
  'FETCHING',
  'INDEXING',
  'ANALYZING',
] as const;

/**
 * Checks whether any repository item currently has an active indexing job.
 */
export function hasActiveJob(
  items: Array<{ latest_job_status?: string | null }>
): boolean {
  return items.some(
    (item) =>
      item.latest_job_status &&
      (IN_PROGRESS_JOB_STATUSES as readonly string[]).includes(item.latest_job_status)
  );
}

/**
 * Computes the delay (in milliseconds) before the next poll attempt.
 *
 * Rules:
 * - If Retry-After is specified, honour it capped at 120s.
 * - If no items are in progress, returns null (polling should stop).
 * - Under 60s of active polling: 4000ms (4s).
 * - At or after 60s of active polling: 10000ms (10s).
 */
export function computeNextPollDelay(
  hasActive: boolean,
  activeDurationMs: number,
  retryAfterSeconds?: number
): number | null {
  if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
    const capped = Math.min(retryAfterSeconds, 120);
    return capped * 1000;
  }

  if (!hasActive) {
    return null;
  }

  if (activeDurationMs >= 60000) {
    return 10000;
  }

  return 4000;
}
