import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../ui/MaterialIcon';
import { Button } from '../ui/button';
import { toast } from '../ui/sonner';
import { api, type SearchResultItem } from '../../lib/api';
import type { FileContent } from '../../lib/types';

interface SearchCodePreviewProps {
  result: SearchResultItem | null;
  repoId: string;
  onClose?: () => void;
}

export function SearchCodePreview({ result, repoId, onClose }: SearchCodePreviewProps) {
  const navigate = useNavigate();
  const [fileContent, setFileContent] = React.useState<FileContent | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const activeLineRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!result) {
      setFileContent(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    api.getFileContent(repoId, result.file_path)
      .then((content) => {
        if (isMounted) {
          setFileContent(content);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setFileContent(null);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [repoId, result]);

  // Scroll active line into view
  React.useEffect(() => {
    if (activeLineRef.current) {
      setTimeout(() => {
        activeLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
    }
  }, [result, fileContent]);

  if (!result) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-surface-raised border border-white/10 rounded-lg">
        <MaterialIcon name="code" size={32} className="text-text-tertiary mb-3" aria-hidden="true" />
        <h3 className="text-sm font-medium text-text-primary mb-1">No search match selected</h3>
        <p className="text-xs text-text-secondary max-w-xs">
          Select a search result from the list to preview the matching code and surrounding context.
        </p>
      </div>
    );
  }

  const handleCopy = () => {
    const text = result.snippet || fileContent?.content || '';
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Snippet copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenFile = () => {
    navigate(
      `/repositories/${repoId}/files?path=${encodeURIComponent(result.file_path)}&line=${result.start_line}`
    );
  };

  // Prepare line items
  const fullLines = fileContent?.content ? fileContent.content.split('\n') : null;
  const snippetLines = result.snippet.split('\n');

  return (
    <div className="h-full flex flex-col bg-surface-raised border border-white/10 rounded-lg overflow-hidden select-text">
      {/* Header bar */}
      <div className="flex items-center justify-between p-3 border-b border-white/10 bg-surface-overlay gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 text-text-secondary hover:text-text-primary shrink-0 lg:hidden"
              aria-label="Close preview"
            >
              <MaterialIcon name="arrow_back" size={16} />
            </Button>
          )}
          <MaterialIcon name="description" size={16} className="text-text-secondary shrink-0" aria-hidden="true" />
          <span className="font-mono text-xs text-text-primary truncate" title={result.file_path}>
            {result.file_path}
          </span>
          <span className="shrink-0 text-xs font-mono px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
            L{result.start_line}–L{result.end_line}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2.5 text-xs text-text-secondary hover:text-text-primary border-white/10"
            aria-label="Copy snippet"
          >
            <MaterialIcon name={copied ? 'check' : 'content_copy'} size={14} className={copied ? 'text-accent' : ''} />
            <span className="hidden sm:inline ml-1.5">{copied ? 'Copied' : 'Copy'}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenFile}
            className="h-7 px-2.5 text-xs gap-1.5"
            aria-label="Open in file viewer"
          >
            <MaterialIcon name="open_in_new" size={14} />
            <span className="hidden sm:inline">Open file</span>
          </Button>
        </div>
      </div>

      {/* Code body with line highlighting */}
      <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed bg-surface-base">
        {loading && !fullLines ? (
          <div className="p-4 text-center text-xs text-text-secondary font-mono">
            Loading full file context…
          </div>
        ) : fullLines ? (
          <div className="divide-y divide-transparent">
            {fullLines.map((line, idx) => {
              const lineNum = idx + 1;
              const isHighlighted = lineNum >= result.start_line && lineNum <= result.end_line;
              const isFirst = lineNum === result.start_line;

              return (
                <div
                  key={lineNum}
                  ref={isFirst ? activeLineRef : undefined}
                  className={`flex items-start transition-colors px-2 py-0.5 rounded-xs ${
                    isHighlighted
                      ? 'bg-accent/15 border-l-2 border-accent text-text-primary'
                      : 'text-text-secondary hover:bg-white/[0.02]'
                  }`}
                >
                  <span className="w-10 shrink-0 text-right pr-3 select-none text-text-tertiary opacity-60">
                    {lineNum}
                  </span>
                  <pre className="flex-1 whitespace-pre overflow-x-auto m-0 p-0 font-mono">
                    <code>{line || ' '}</code>
                  </pre>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-0.5">
            {snippetLines.map((line, idx) => {
              const lineNum = result.start_line + idx;
              return (
                <div
                  key={lineNum}
                  className="flex items-start px-2 py-0.5 bg-accent/15 border-l-2 border-accent text-text-primary"
                >
                  <span className="w-10 shrink-0 text-right pr-3 select-none text-accent/70 font-mono">
                    {lineNum}
                  </span>
                  <pre className="flex-1 whitespace-pre overflow-x-auto m-0 p-0 font-mono">
                    <code>{line || ' '}</code>
                  </pre>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
