import { describe, it, expect } from 'vitest';
import { formatCoverageLine } from './formatter';
import type { CoverageOut } from './types';

describe('formatCoverageLine', () => {
  it('handles null/undefined gracefully', () => {
    expect(formatCoverageLine(null)).toBe('Coverage data unavailable');
    expect(formatCoverageLine(undefined)).toBe('Coverage data unavailable');
  });

  it('formats standard coverage with analyzed and unanalyzed languages', () => {
    const coverage: CoverageOut = {
      internal_imports_total: 100,
      resolved: 87,
      ratio: 0.87,
      languages_analyzed: ['Python', 'TypeScript'],
      languages_not_analyzed: [{ language: 'Go', files: 12 }],
    };

    const result = formatCoverageLine(coverage);
    expect(result).toBe(
      '87% of internal imports resolved — analyzed: Python, TypeScript — not analyzed: Go (12 files)'
    );
  });

  it('handles single unanalyzed file pluralization', () => {
    const coverage: CoverageOut = {
      internal_imports_total: 50,
      resolved: 50,
      ratio: 1.0,
      languages_analyzed: ['Python'],
      languages_not_analyzed: [{ language: 'Rust', files: 1 }],
    };

    const result = formatCoverageLine(coverage);
    expect(result).toBe(
      '100% of internal imports resolved — analyzed: Python — not analyzed: Rust (1 file)'
    );
  });

  it('handles zero internal imports detected', () => {
    const coverage: CoverageOut = {
      internal_imports_total: 0,
      resolved: 0,
      ratio: 0.0,
      languages_analyzed: ['TypeScript'],
      languages_not_analyzed: [],
    };

    const result = formatCoverageLine(coverage);
    expect(result).toBe('0 internal imports detected — analyzed: TypeScript');
  });
});

