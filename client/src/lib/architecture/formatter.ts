import type { CoverageOut } from './types';

/**
 * Pure function to format architecture import coverage into a human-readable status line.
 * Example: "87% of internal imports resolved — analyzed: Python, TypeScript — not analyzed: Go (12 files)"
 */
export function formatCoverageLine(coverage?: CoverageOut | null): string {
  if (!coverage) {
    return 'Coverage data unavailable';
  }

  const { internal_imports_total, ratio, languages_analyzed, languages_not_analyzed } = coverage;

  const pct = Math.round(ratio * 100);
  const analyzedStr = languages_analyzed.length > 0 ? languages_analyzed.join(', ') : 'None';

  let base = `${pct}% of internal imports resolved — analyzed: ${analyzedStr}`;
  if (internal_imports_total === 0) {
    base = `0 internal imports detected — analyzed: ${analyzedStr}`;
  }

  if (languages_not_analyzed && languages_not_analyzed.length > 0) {
    const notAnalyzedParts = languages_not_analyzed.map(
      (item) => `${item.language} (${item.files} ${item.files === 1 ? 'file' : 'files'})`
    );
    base += ` — not analyzed: ${notAnalyzedParts.join(', ')}`;
  }

  return base;
}

