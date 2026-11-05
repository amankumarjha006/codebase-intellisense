import * as React from 'react';
import { MaterialIcon } from '../ui/MaterialIcon';
import { Citation } from '../../lib/types';

interface CitationListProps {
  citations: Citation[];
  repoId: string;
  onSelectCitation: (citation: Citation) => void;
  selectedCitation?: Citation | null;
}

export function CitationList({
  citations,
  onSelectCitation,
  selectedCitation,
}: CitationListProps) {
  if (!citations || citations.length === 0) {
    return null;
  }

  return (
    <div className="pt-2.5 border-t border-white/5 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
        <MaterialIcon name="verified" size={13} className="text-accent" />
        <span className="font-medium">Sources cited ({citations.length})</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {citations.map((c, idx) => {
          const isSelected =
            selectedCitation?.path === c.path && selectedCitation?.start_line === c.start_line;
          const fileName = c.path.split('/').pop() || c.path;
          const hasValidRange = c.start_line > 0 && c.end_line >= c.start_line;
          const lineText = hasValidRange
            ? c.start_line === c.end_line
              ? `:${c.start_line}`
              : `:${c.start_line}-${c.end_line}`
            : '';

          return (
            <button
              key={`${c.path}-${c.start_line}-${idx}`}
              type="button"
              onClick={() => onSelectCitation(c)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono transition-colors border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                isSelected
                  ? 'bg-accent/15 border-accent text-accent'
                  : 'bg-surface-raised border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20'
              }`}
              title={`${c.path}${lineText}`}
            >
              <span className="text-[11px] text-accent font-semibold font-mono">
                [{idx + 1}]
              </span>
              <span className="truncate max-w-[180px]">
                {fileName}{lineText}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
