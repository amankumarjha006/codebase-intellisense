import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { MaterialIcon } from '../ui/MaterialIcon';
import { Citation, FileContent } from '../../lib/types';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { toast } from '../ui/sonner';

interface SourcePanelProps {
  citation: Citation | null;
  repoId: string;
  onClose: () => void;
  className?: string;
}

export function SourcePanel({ citation, repoId, onClose, className = '' }: SourcePanelProps) {
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
    <motion.aside
      role="region"
      aria-label={`Source citation for ${citation.path}`}
      initial={{ x: 30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 30, opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`flex flex-col h-full bg-surface-raised border-l border-white/10 select-text ${className}`}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10 bg-surface-base/50">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close citation panel (Esc)"
            className="h-7 w-7 text-text-tertiary hover:text-text-primary"
          >
            <MaterialIcon name="arrow_back" size={16} />
          </Button>

          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary truncate font-mono">
              <MaterialIcon name="code" size={14} className="text-accent shrink-0" />
              <span className="truncate">{citation.path}</span>
            </div>
            <div className="text-[11px] text-accent font-mono">
              {lineBadge}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopyCode}
            aria-label="Copy snippet"
            className="h-7 w-7 text-text-tertiary hover:text-text-primary"
          >
            <MaterialIcon name={copied ? 'check' : 'content_copy'} size={14} className={copied ? 'text-accent' : ''} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const lineQuery = citation.start_line > 0 ? `&start_line=${citation.start_line}&end_line=${citation.end_line}` : '';
              navigate(`/repositories/${repoId}/files?path=${encodeURIComponent(citation.path)}${lineQuery}`);
            }}
            aria-label="Open in full file viewer"
            className="h-7 w-7 text-text-tertiary hover:text-text-primary"
          >
            <MaterialIcon name="open_in_new" size={14} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close panel"
            className="h-7 w-7 text-text-tertiary hover:text-text-primary"
          >
            <MaterialIcon name="close" size={16} />
          </Button>
        </div>
      </div>

      {/* Code viewer with highlighted cited lines */}
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-5 bg-surface-base">
        {loading ? (
          <div className="space-y-2 py-4">
            <div className="h-4 bg-surface-raised rounded animate-pulse w-3/4" />
            <div className="h-4 bg-surface-raised rounded animate-pulse w-1/2" />
            <div className="h-4 bg-surface-raised rounded animate-pulse w-5/6" />
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
                      ? 'bg-accent/15 text-text-primary font-medium'
                      : 'hover:bg-surface-raised/40 text-text-secondary'
                  }`}
                >
                  <div
                    className={`table-cell pr-3 pl-1 py-0.5 select-none text-right font-mono text-[11px] tabular-nums border-r border-white/5 w-10 ${
                      isTargetLine ? 'text-accent font-bold' : 'text-text-tertiary'
                    }`}
                  >
                    {lineNum}
                  </div>
                  <div className="table-cell pl-3 py-0.5 whitespace-pre overflow-x-auto text-[12px]">
                    {line || ' '}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.aside>
  );
}
