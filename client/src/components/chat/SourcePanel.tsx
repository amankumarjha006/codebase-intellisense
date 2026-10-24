import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { MaterialIcon } from '../ui/MaterialIcon';
import { Citation, FileContent } from '../../lib/types';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface SourcePanelProps {
  citation: Citation | null;
  repoId: string;
  onClose: () => void;
}

export function SourcePanel({ citation, repoId, onClose }: SourcePanelProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = React.useState(false);
  const [fileContent, setFileContent] = React.useState<FileContent | null>(null);
  const [loading, setLoading] = React.useState(false);
  const firstCitedLineRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!citation) return;
    setLoading(true);
    api.getFileContent(repoId, citation.path)
      .then((data: FileContent) => {
        setFileContent(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [citation, repoId]);

  // Scroll to cited line after content loads
  React.useEffect(() => {
    if (!loading && firstCitedLineRef.current) {
      setTimeout(() => {
        firstCitedLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [loading, citation]);

  if (!citation) return null;

  const handleCopyCode = () => {
    const textToCopy = citation.snippet || fileContent?.content || '';
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = (fileContent?.content || citation.snippet || '').split('\n');

  const hasLineRange = citation.start_line > 0 && citation.end_line >= citation.start_line;
  const lineBadge = hasLineRange
    ? citation.start_line === citation.end_line
      ? `Line ${citation.start_line}`
      : `Lines ${citation.start_line}–${citation.end_line}`
    : 'File Reference';

  return (
    <TooltipProvider delayDuration={200}>
      <motion.aside
        role="region"
        aria-label={`Source code citation for ${citation.path}`}
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 60, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col h-full bg-[var(--color-surface)] border-l border-[var(--color-border)] w-full md:w-[480px] lg:w-[540px] z-20 shrink-0 select-text shadow-2xl"
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-[var(--color-border)] bg-[var(--color-raised)]/40">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              title="Back to conversation"
              aria-label="Back to conversation"
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              <MaterialIcon name="arrow_back" size={18} aria-hidden="true" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text)] truncate font-mono">
                <MaterialIcon name="code" size={16} className="text-[var(--color-mint-accent,#B9E4D0)] shrink-0" aria-hidden="true" />
                <span className="truncate">{citation.path}</span>
              </div>
              <div className="text-[11px] text-[var(--color-mint-accent,#B9E4D0)] font-mono">
                {lineBadge}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleCopyCode}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                  aria-label="Copy citation snippet"
                >
                  {copied ? (
                    <MaterialIcon name="check" size={16} className="text-[var(--color-mint-accent,#B9E4D0)]" aria-hidden="true" />
                  ) : (
                    <MaterialIcon name="content_copy" size={16} aria-hidden="true" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {copied ? 'Copied to clipboard' : 'Copy code snippet'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => navigate(`/repositories/${repoId}/files?path=${encodeURIComponent(citation.path)}`)}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-mint-accent,#B9E4D0)]"
                  aria-label="Open in full file viewer"
                >
                  <MaterialIcon name="open_in_new" size={16} aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Open in Full File Viewer
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onClose}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                  aria-label="Close source panel"
                >
                  <MaterialIcon name="close" size={18} aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Close Panel
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Code Viewer Body */}
        <div
          className="flex-1 overflow-y-auto p-2 font-mono text-xs leading-5 bg-[var(--color-page)] no-scrollbar"
          tabIndex={0}
          role="region"
          aria-label="Citation code lines"
        >
          {loading ? (
            <div className="p-8 text-center text-xs text-[var(--color-muted)] flex flex-col items-center gap-2">
              <MaterialIcon name="sync" size={20} spin className="text-[var(--color-mint-accent,#B9E4D0)]" aria-hidden="true" />
              <span>Loading repository file lines...</span>
            </div>
          ) : (
            <div className="table w-full">
              {lines.map((lineText, idx) => {
                const lineNum = idx + 1;
                const isCited = lineNum >= citation.start_line && lineNum <= citation.end_line;
                const isFirstCited = lineNum === citation.start_line;

                return (
                  <div
                    key={lineNum}
                    ref={isFirstCited ? firstCitedLineRef : undefined}
                    className={`table-row transition-colors ${
                      isCited
                        ? 'bg-[var(--color-mint-selected-bg,#253A32)]/80 border-l-2 border-[var(--color-mint-accent,#B9E4D0)] font-medium text-[var(--color-text)]'
                        : 'hover:bg-[var(--color-raised)]/40 text-[var(--color-text-secondary)]'
                    }`}
                  >
                    <span className="table-cell select-none pr-4 pl-2 text-right text-[11px] text-[var(--color-muted)] w-10 border-r border-[var(--color-border)]/40">
                      {lineNum}
                    </span>
                    <span className="table-cell pl-3 whitespace-pre overflow-x-auto text-[var(--color-text)]">
                      {lineText || ' '}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between text-[11px] text-[var(--color-muted)] font-mono">
          <div className="flex items-center gap-1.5 text-[var(--color-mint-accent,#B9E4D0)]">
            <MaterialIcon name="description" size={14} aria-hidden="true" />
            <span>Source Reference</span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs font-sans"
            onClick={() => navigate(`/repositories/${repoId}/files?path=${encodeURIComponent(citation.path)}`)}
            aria-label="View complete file in browser"
          >
            <span>View Full File</span>
            <MaterialIcon name="chevron_right" size={14} aria-hidden="true" />
          </Button>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}
