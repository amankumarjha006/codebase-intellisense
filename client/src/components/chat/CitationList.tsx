import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../ui/MaterialIcon';
import { Citation } from '../../lib/types';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface CitationListProps {
  citations: Citation[];
  repoId: string;
  onSelectCitation: (citation: Citation) => void;
  selectedCitation?: Citation | null;
}

export function CitationList({
  citations,
  repoId,
  onSelectCitation,
  selectedCitation,
}: CitationListProps) {
  const navigate = useNavigate();
  const [copiedPath, setCopiedPath] = React.useState<string | null>(null);

  const handleCopyPath = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const handleOpenFile = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    navigate(`/repositories/${repoId}/files?path=${encodeURIComponent(path)}`);
  };

  if (!citations || citations.length === 0) {
    return (
      <div className="pt-2 text-[11px] text-[var(--color-muted)] flex items-center gap-1.5 border-t border-[var(--color-border)]/40 font-mono">
        <MaterialIcon name="info" size={14} className="text-[var(--color-muted)] shrink-0" aria-hidden="true" />
        <span>No direct code citations attached to this response. Verify repository facts manually.</span>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="pt-3 border-t border-[var(--color-border)]/60 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-medium text-[var(--color-text-secondary)]">
            <MaterialIcon name="verified" size={15} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
            <span className="text-[11px] uppercase tracking-wider font-mono text-[var(--color-mint-accent,#B9E4D0)]">
              Supporting Citations ({citations.length})
            </span>
          </div>
          <span className="text-[10px] text-[var(--color-muted)] font-mono">
            Click citation to inspect lines
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {citations.map((c, idx) => {
            const isSelected = selectedCitation?.path === c.path && selectedCitation?.start_line === c.start_line;
            const pathParts = c.path.split('/');
            const fileName = pathParts.pop() || c.path;
            const dirPath = pathParts.join('/');

            const hasValidLineRange = c.start_line > 0 && c.end_line >= c.start_line;
            const lineText = hasValidLineRange
              ? c.start_line === c.end_line
                ? `L${c.start_line}`
                : `L${c.start_line}–${c.end_line}`
              : null;

            return (
              <div
                key={idx}
                onClick={() => onSelectCitation(c)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectCitation(c);
                  }
                }}
                className={`group relative flex items-center justify-between p-2 rounded-[var(--radius-control)] border text-left cursor-pointer transition ${
                  isSelected
                    ? 'border-[var(--color-mint-accent,#B9E4D0)] bg-[var(--color-mint-selected-bg,#253A32)] text-[var(--color-mint-accent,#B9E4D0)] shadow-sm'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[rgba(185,228,208,0.4)] hover:bg-[var(--color-raised)]/60 text-[var(--color-text)]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <MaterialIcon
                    name="description"
                    size={16}
                    fill={isSelected ? 1 : 0}
                    color={isSelected ? 'var(--color-mint-accent, #B9E4D0)' : undefined}
                    className="shrink-0 text-[var(--color-muted)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition-colors"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-medium truncate flex items-center gap-1.5">
                      <span className="truncate text-[var(--color-text)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition-colors">
                        {fileName}
                      </span>
                      {lineText && (
                        <span className="shrink-0 text-[10px] px-1.5 py-0.2 rounded bg-[var(--color-raised)] border border-[var(--color-border)] text-[var(--color-mint-accent,#B9E4D0)] font-mono">
                          {lineText}
                        </span>
                      )}
                    </div>
                    {dirPath && (
                      <div className="text-[10px] text-[var(--color-muted)] font-mono truncate">
                        {dirPath}/
                      </div>
                    )}
                  </div>
                </div>

                {/* Citation Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-75 group-hover:opacity-100 transition-opacity">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => handleCopyPath(e, c.path)}
                        className="h-6 w-6 text-[var(--color-muted)] hover:text-[var(--color-text)]"
                        aria-label={`Copy path ${c.path}`}
                      >
                        {copiedPath === c.path ? (
                          <MaterialIcon name="check" size={13} className="text-[var(--color-mint-accent,#B9E4D0)]" aria-hidden="true" />
                        ) : (
                          <MaterialIcon name="content_copy" size={13} aria-hidden="true" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {copiedPath === c.path ? 'Path copied!' : 'Copy relative path'}
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => handleOpenFile(e, c.path)}
                        className="h-6 w-6 text-[var(--color-muted)] hover:text-[var(--color-mint-accent,#B9E4D0)]"
                        aria-label={`Open ${fileName} in File Viewer`}
                      >
                        <MaterialIcon name="open_in_new" size={13} aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Open in File Viewer
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
