import { describe, it, expect } from 'vitest';
import { deriveRowStatus, getFailureMessage, FAILURE_MESSAGES, DEFAULT_FAILURE_MESSAGE } from './status';

describe('deriveRowStatus', () => {
  it('case 1: no version + no job = Not indexed', () => {
    const res = deriveRowStatus(null, null);
    expect(res).toEqual({
      kind: 'not-indexed',
      label: 'Not indexed',
      showProgress: false,
      actions: ['index'],
    });
  });

  it('case 2: no version + in progress', () => {
    const res1 = deriveRowStatus('QUEUED', null);
    expect(res1).toEqual({
      kind: 'in-progress',
      label: 'Queued',
      showProgress: true,
      actions: [],
    });

    const res2 = deriveRowStatus('INDEXING', null);
    expect(res2).toEqual({
      kind: 'in-progress',
      label: 'Indexing',
      showProgress: true,
      actions: [],
    });
  });

  it('case 3: no version + failed', () => {
    const res = deriveRowStatus('FAILED', null);
    expect(res).toEqual({
      kind: 'failed',
      label: 'Failed',
      showProgress: false,
      actions: ['retry'],
    });
  });

  it('case 4: version + ready (no job or completed)', () => {
    const res1 = deriveRowStatus(null, 'a1b2c3d');
    expect(res1).toEqual({
      kind: 'ready',
      label: 'Ready',
      showProgress: false,
      actions: [],
    });

    const res2 = deriveRowStatus('SUCCESS', 'a1b2c3d');
    expect(res2).toEqual({
      kind: 'ready',
      label: 'Ready',
      showProgress: false,
      actions: [],
    });
  });

  it('case 5: version + in progress = Ready + Updating', () => {
    const res = deriveRowStatus('FETCHING', 'a1b2c3d');
    expect(res).toEqual({
      kind: 'ready',
      label: 'Ready',
      subtitle: 'Updating…',
      showProgress: true,
      actions: [],
    });
  });

  it('case 6: version + failed = Ready + Last update failed', () => {
    const res = deriveRowStatus('FAILED', 'a1b2c3d');
    expect(res).toEqual({
      kind: 'ready',
      label: 'Ready',
      subtitle: 'Last update failed',
      showProgress: false,
      actions: ['retry'],
    });
  });
});

describe('getFailureMessage', () => {
  it('returns mapped failure message for known codes', () => {
    expect(getFailureMessage('CLONE_FAILED')).toBe(FAILURE_MESSAGES.CLONE_FAILED);
    expect(getFailureMessage('EMBEDDING_PROVIDER_RATE_LIMITED')).toBe(
      FAILURE_MESSAGES.EMBEDDING_PROVIDER_RATE_LIMITED
    );
  });

  it('falls back to default failure message for unknown or null codes', () => {
    expect(getFailureMessage(null)).toBe(DEFAULT_FAILURE_MESSAGE);
    expect(getFailureMessage('UNKNOWN_CODE_ABC')).toBe(DEFAULT_FAILURE_MESSAGE);
  });
});
