export type ChipKind = 'not-indexed' | 'in-progress' | 'failed' | 'ready';
export type RowAction = 'index' | 'retry';

export interface RowStatusDerivation {
  kind: ChipKind;
  label: string;
  showProgress: boolean;
  actions: RowAction[];
  subtitle?: string;
}

export const IN_PROGRESS_STATUSES = ['QUEUED', 'FETCHING', 'INDEXING', 'ANALYZING'] as const;

export const FAILURE_MESSAGES: Record<string, string> = {
  EMBEDDING_PROVIDER_RATE_LIMITED: 'Our AI provider is busy. Wait a minute, then retry.',
  EMBEDDING_PROVIDER_UNAVAILABLE: "We couldn't reach our AI provider. Please try again in a few minutes.",
  EMBEDDING_PROVIDER_AUTH: 'Indexing is unavailable right now. Please contact support.',
  CLONE_FAILED: "We couldn't fetch this repository. Check it exists and is accessible.",
  REPOSITORY_TOO_LARGE: 'This repository is too large to index.',
  INTERNAL_ERROR: 'Indexing failed. Please try again.',
};

export const DEFAULT_FAILURE_MESSAGE = 'Indexing failed. Please try again.';

export function getFailureMessage(code: string | null | undefined): string {
  if (!code) {
    return DEFAULT_FAILURE_MESSAGE;
  }
  return FAILURE_MESSAGES[code] || DEFAULT_FAILURE_MESSAGE;
}

function formatStatusLabel(status: string): string {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

/**
 * Pure function deriving row status presentation for repository items.
 *
 * Covers the 6 cases:
 * 1. no version + no job -> { kind: 'not-indexed', label: 'Not indexed', showProgress: false, actions: ['index'] }
 * 2. no version + in progress -> { kind: 'in-progress', label: '<Status>', showProgress: true, actions: [] }
 * 3. no version + failed -> { kind: 'failed', label: 'Failed', showProgress: false, actions: ['retry'] }
 * 4. version + ready -> { kind: 'ready', label: 'Ready', showProgress: false, actions: [] }
 * 5. version + in progress -> { kind: 'ready', label: 'Ready', subtitle: 'Updating…', showProgress: true, actions: [] }
 * 6. version + failed -> { kind: 'ready', label: 'Ready', subtitle: 'Last update failed', showProgress: false, actions: ['retry'] }
 */
export function deriveRowStatus(
  latest_job_status: string | null | undefined,
  active_version_short_sha: string | null | undefined
): RowStatusDerivation {
  const hasVersion = Boolean(active_version_short_sha);
  const status = latest_job_status || null;
  const isInProgress = status !== null && (IN_PROGRESS_STATUSES as readonly string[]).includes(status);
  const isFailed = status === 'FAILED';

  // Case 1: no version + no job
  if (!hasVersion && !status) {
    return {
      kind: 'not-indexed',
      label: 'Not indexed',
      showProgress: false,
      actions: ['index'],
    };
  }

  // Case 2: no version + in progress
  if (!hasVersion && isInProgress) {
    return {
      kind: 'in-progress',
      label: formatStatusLabel(status),
      showProgress: true,
      actions: [],
    };
  }

  // Case 3: no version + failed
  if (!hasVersion && isFailed) {
    return {
      kind: 'failed',
      label: 'Failed',
      showProgress: false,
      actions: ['retry'],
    };
  }

  // Cases with an active version:
  if (hasVersion) {
    // Case 5: version + in progress
    if (isInProgress) {
      return {
        kind: 'ready',
        label: 'Ready',
        subtitle: 'Updating…',
        showProgress: true,
        actions: [],
      };
    }

    // Case 6: version + failed
    if (isFailed) {
      return {
        kind: 'ready',
        label: 'Ready',
        subtitle: 'Last update failed',
        showProgress: false,
        actions: ['retry'],
      };
    }

    // Case 4: version + ready (or no active job)
    return {
      kind: 'ready',
      label: 'Ready',
      showProgress: false,
      actions: [],
    };
  }

  // Fallback for any other unexpected combinations
  return {
    kind: 'not-indexed',
    label: 'Not indexed',
    showProgress: false,
    actions: ['index'],
  };
}
