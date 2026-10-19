import { describe, it, expect } from 'vitest';
import { hasActiveJob, computeNextPollDelay } from './polling';

describe('hasActiveJob', () => {
  it('returns false for empty array', () => {
    expect(hasActiveJob([])).toBe(false);
  });

  it('returns false when no jobs are active', () => {
    expect(
      hasActiveJob([
        { latest_job_status: 'READY' },
        { latest_job_status: 'FAILED' },
        { latest_job_status: null },
      ])
    ).toBe(false);
  });

  it('returns true when any job is queued, fetching, indexing, or analyzing', () => {
    expect(hasActiveJob([{ latest_job_status: 'QUEUED' }])).toBe(true);
    expect(hasActiveJob([{ latest_job_status: 'FETCHING' }])).toBe(true);
    expect(hasActiveJob([{ latest_job_status: 'INDEXING' }])).toBe(true);
    expect(hasActiveJob([{ latest_job_status: 'ANALYZING' }])).toBe(true);
  });
});

describe('computeNextPollDelay', () => {
  it('returns null when nothing is active and no retry-after', () => {
    expect(computeNextPollDelay(false, 0)).toBeNull();
    expect(computeNextPollDelay(false, 70000)).toBeNull();
  });

  it('returns 4000ms while active under 60 seconds', () => {
    expect(computeNextPollDelay(true, 0)).toBe(4000);
    expect(computeNextPollDelay(true, 59999)).toBe(4000);
  });

  it('returns 10000ms while active at or after 60 seconds', () => {
    expect(computeNextPollDelay(true, 60000)).toBe(10000);
    expect(computeNextPollDelay(true, 120000)).toBe(10000);
  });

  it('honours Retry-After capped at 120s', () => {
    expect(computeNextPollDelay(true, 0, 15)).toBe(15000);
    expect(computeNextPollDelay(false, 0, 30)).toBe(30000);
    expect(computeNextPollDelay(true, 0, 300)).toBe(120000);
  });
});
