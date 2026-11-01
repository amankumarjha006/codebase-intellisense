import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { MaterialIcon } from '../ui/MaterialIcon';
import { Citation, FileContent } from '../../lib/types';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { toast } from '../ui/sonner';

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

  // Close panel on Esc key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
    toast.success('Source code snippet copied to clipboard');
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
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col h-full bg-[var(--color-surface)] border-l border-[var(--color-border)] w-full md:w-[480px] lg:w-[540px] z-20 shrink-0 select-text shadow-2xl"
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-[var(--color-border)] bg-[var(--color-raised)]/40">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              title="Back to conversation (Esc)"
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
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer"
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
                  onClick={() => {
                    const lineQuery = citation.start_line > 0 ? `&start_line=${citation.start_line}&end_line=${citation.end_line}` : '';
                    navigate(`/repositories/${repoId}/files?path=${encodeURIComponent(citation.path)}${lineQuery}`);
                  }}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-mint-accent,#B9E4D0)] cursor-pointer"
                  aria-label="Open in full file viewer"
                >
                  <MaterialIcon name="open_in_new" size={16} aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Open in Full File Viewer
              </TooltipContent>
            </Tooltip>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              className="text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer ml-1"
              title="Close panel (Esc)"
              aria-label="Close citation drawer"
            >
              <MaterialIcon name="close" size={18} aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Panel Code Content */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-5 bg-[#0e0e0d]">
          {loading ? (
            <div className="space-y-2 py-4">
              <div className="h-4 bg-[var(--color-raised)] rounded animate-pulse w-3/4" />
              <div className="h-4 bg-[var(--color-raised)] rounded animate-pulse w-1/2" />
              <div className="h-4 bg-[var(--color-raised)] rounded animate-pulse w-5/6" />
              <div className="h-4 bg-[var(--color-raised)] rounded animate-pulse w-2/3" />
            </div>
          ) : (
            <div className="table w-full border-collapse">
              {lines.map((line, index) => {
                const lineNum = index + 1;
                const isTargetLine = hasLineRange && lineNum >= citation.start_line && lineNum <= citation.end_line;
                const isFirstTarget = hasLineRange && lineNum === citation.start_line;

                return (
                  <div
                    key={index}
                    ref={isFirstTarget ? firstCitedLineRef : undefined}
                    className={`table-row transition-colors ${
                      isTargetLine
                        ? 'bg-[var(--color-mint-selected-bg,#1B332A)]/40 text-[var(--color-text)] font-semibold'
                        : 'hover:bg-[var(--color-raised)]/30 text-[var(--color-text-secondary)]'
                    }`}
                  >
                    <div
                      className={`table-cell pr-4 pl-2 py-0.5 select-none text-right font-mono text-[11px] tabular-nums border-r border-[var(--color-border)]/40 w-12 ${
                        isTargetLine ? 'text-[var(--color-mint-accent,#B9E4D0)] font-bold' : 'text-[var(--color-muted)]'
                      }`}
                    >
                      {lineNum}
                    </div>
                    <div
                      className={`table-cell pl-4 py-0.5 whitespace-pre font-mono overflow-x-auto ${
                        isTargetLine ? 'border-l-2 border-[var(--color-mint-accent,#B9E4D0)] pl-3.5' : ''
                      }`}
                    >
                      {line || ' '}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel Footer */}
        <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-raised)]/30 flex items-center justify-between text-xs text-[var(--color-muted)] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--color-mint-accent,#B9E4D0)]" aria-hidden="true" />
            <span>Verified repository evidence</span>
          </div>
          <span className="text-[11px] text-[var(--color-text-secondary)]">Press Esc to close</span>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}
