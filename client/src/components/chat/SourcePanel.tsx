import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  FileCode,
  ArrowLeft,
} from 'lucide-react';
import { Citation, FileContent } from '../../lib/types';
import { api } from '../../lib/api';
import { Button } from '../ui/button';

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

  React.useEffect(() => {
    if (!citation) return;
    setLoading(true);
    api.getFileContent(repoId, citation.path).then((data: FileContent) => {
      setFileContent(data);
      setLoading(false);
    });
  }, [citation, repoId]);

  if (!citation) return null;

  const handleCopyCode = () => {
    const textToCopy = citation.snippet || fileContent?.content || '';
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = (fileContent?.content || citation.snippet || '').split('\n');

  return (
    <motion.aside
      role="region"
      aria-label={`Source code citation for ${citation.path}`}
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 60, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col h-full bg-[var(--color-surface)] border-l border-[var(--color-border)] w-full md:w-[480px] lg:w-[540px] z-20 shrink-0 select-text shadow-xl"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-raised)]/40">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            title="Back to conversation"
            aria-label="Back to conversation"
          >
            <ArrowLeft size={15} aria-hidden="true" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text)] truncate font-mono">
              <FileCode size={13} className="text-[var(--color-accent)] shrink-0" aria-hidden="true" />
              <span className="truncate">{citation.path}</span>
            </div>
            <div className="text-[11px] text-[var(--color-accent)] font-mono">
              Lines {citation.start_line}–{citation.end_line}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCopyCode}
            title="Copy code snippet"
            aria-label="Copy code snippet"
          >
            {copied ? (
              <Check size={14} className="text-[var(--color-accent)]" aria-hidden="true" />
            ) : (
              <Copy size={14} aria-hidden="true" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate(`/repositories/${repoId}/files?path=${encodeURIComponent(citation.path)}`)}
            title="Open in full file viewer"
            aria-label="Open in full file viewer"
          >
            <ExternalLink size={14} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            title="Close source panel"
            aria-label="Close source panel"
          >
            <X size={15} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Code Viewer Body */}
      <div
        className="flex-1 overflow-y-auto p-2 font-mono text-xs leading-5 bg-[var(--color-page)]"
        tabIndex={0}
        role="region"
        aria-label="Citation code lines"
      >
        {loading ? (
          <div className="p-8 text-center text-xs text-[var(--color-muted)]">Loading file lines...</div>
        ) : (
          <div className="table w-full">
            {lines.map((lineText, idx) => {
              const lineNum = idx + 1;
              const isCited = lineNum >= citation.start_line && lineNum <= citation.end_line;

              return (
                <div
                  key={lineNum}
                  className={`table-row transition-colors ${
                    isCited
                      ? 'bg-[var(--color-accent-tint)] border-l-2 border-[var(--color-accent)] font-medium'
                      : 'hover:bg-[var(--color-raised)]/40'
                  }`}
                >
                  <span className="table-cell select-none pr-4 pl-2 text-right text-[11px] text-[var(--color-muted)] w-10 border-r border-[var(--color-border)]/40">
                    {lineNum}
                  </span>
                  <span className="table-cell pl-3 text-[var(--color-text)] whitespace-pre overflow-x-auto">
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
        <span>AST Citation Grounded</span>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs font-sans"
          onClick={() => navigate(`/repositories/${repoId}/files?path=${encodeURIComponent(citation.path)}`)}
          aria-label="View complete file in browser"
        >
          View Full File
        </Button>
      </div>
    </motion.aside>
  );
}
