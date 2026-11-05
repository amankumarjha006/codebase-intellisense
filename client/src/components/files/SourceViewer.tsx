import * as React from 'react';
import { MaterialIcon } from '../ui/MaterialIcon';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { toast } from '../ui/sonner';

interface Token {
  content: string;
  color?: string;
  fontStyle?: number;
}

interface SourceViewerProps {
  code: string;
  language?: string;
  filePath: string;
  targetStartLine?: number | null;
  targetEndLine?: number | null;
  onClearTarget?: () => void;
}

export function SourceViewer({
  code,
  language = 'text',
  filePath,
  targetStartLine,
  targetEndLine,
  onClearTarget,
}: SourceViewerProps) {
  const [tokens, setTokens] = React.useState<Token[][] | null>(null);
  const [copiedLine, setCopiedLine] = React.useState<number | null>(null);
  const targetLineRef = React.useRef<HTMLTableRowElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Normalize language for Shiki
  const cleanLang = React.useMemo(() => {
    let lang = (language || 'text').toLowerCase().replace(/^language-/, '');
    if (lang === 'py') lang = 'python';
    if (lang === 'ts') lang = 'typescript';
    if (lang === 'js') lang = 'javascript';
    if (lang === 'yml') lang = 'yaml';
    if (lang === 'sh') lang = 'bash';
    return lang;
  }, [language]);

  // Plain text fallback lines
  const rawLines = React.useMemo(() => code.split('\n'), [code]);

  // Tokenize using Shiki
  React.useEffect(() => {
    let cancelled = false;

    import('shiki')
      .then(async (shiki) => {
        try {
          const res = await shiki.codeToTokens(code, {
            lang: cleanLang as Parameters<typeof shiki.codeToTokens>[1]['lang'],
            theme: 'github-dark',
          });
          if (!cancelled && res.tokens) {
            setTokens(res.tokens);
          }
        } catch {
          // If unsupported, fallback to plain text
          if (!cancelled) {
            setTokens(null);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTokens(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, cleanLang]);

  // Smooth scroll to targeted line when loaded or target line changes
  React.useEffect(() => {
    if (targetStartLine && targetStartLine > 0) {
      const timer = setTimeout(() => {
        targetLineRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [targetStartLine, filePath, tokens]);

  const handleCopyLine = (lineNum: number, lineText: string) => {
    navigator.clipboard.writeText(lineText);
    setCopiedLine(lineNum);
    toast.success(`Copied line ${lineNum}`);
    setTimeout(() => setCopiedLine(null), 1500);
  };

  const hasTarget = Boolean(targetStartLine && targetStartLine > 0);
  const displayEnd = targetEndLine && targetEndLine >= (targetStartLine || 1) ? targetEndLine : targetStartLine;
  const totalLines = tokens ? tokens.length : rawLines.length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface-base select-text font-mono text-xs">
      {/* Targeted Line Range Banner (if navigated from citation or search) */}
      {hasTarget && (
        <div
          role="status"
          aria-live="polite"
          className="px-4 py-2 bg-surface-overlay border-b border-white/10 flex items-center justify-between text-xs select-none shrink-0"
        >
          <div className="flex items-center gap-2 text-text-primary font-medium">
            <MaterialIcon name="pin_drop" size={16} className="text-accent" aria-hidden="true" />
            <span>
              Targeted line reference: L{targetStartLine}
              {displayEnd && displayEnd !== targetStartLine ? `–L${displayEnd}` : ''}
            </span>
            <span className="text-xs text-text-secondary font-mono">
              ({(displayEnd || 1) - (targetStartLine || 1) + 1} lines highlighted)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                targetLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              className="h-6 px-2 text-xs text-accent hover:bg-accent/10"
              aria-label="Scroll to highlighted lines"
            >
              Scroll to lines
            </Button>
            {onClearTarget && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearTarget}
                className="h-6 px-2 text-xs text-text-secondary hover:text-text-primary"
                aria-label="Clear line highlighting"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Code Table Container */}
      <div
        ref={containerRef}
        tabIndex={0}
        role="region"
        aria-label={`Source code content for ${filePath}`}
        className="flex-1 overflow-auto p-2 sm:p-4 font-mono text-xs leading-6 bg-surface-base focus:outline-none"
      >
        <table className="w-full border-collapse" aria-label="Code lines table">
          <tbody>
            {Array.from({ length: totalLines }).map((_, idx) => {
              const lineNum = idx + 1;
              const isTargeted = hasTarget
                ? lineNum >= (targetStartLine || 0) && lineNum <= (displayEnd || 0)
                : false;
              const isFirstTarget = lineNum === targetStartLine;

              // Line content: either Shiki tokens or plain text
              const lineTokens = tokens ? tokens[idx] : null;
              const plainLine = rawLines[idx] ?? '';

              return (
                <tr
                  key={lineNum}
                  id={`line-${lineNum}`}
                  ref={isFirstTarget ? targetLineRef : undefined}
                  className={`group transition-colors ${
                    isTargeted
                      ? 'bg-accent/15 border-l-2 border-accent text-text-primary'
                      : 'hover:bg-white/[0.03] border-l-2 border-transparent'
                  }`}
                >
                  {/* Line Number Column */}
                  <td className="w-12 select-none pr-3 pl-2 text-right text-xs font-mono border-r border-white/10 shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => handleCopyLine(lineNum, plainLine)}
                          className={`cursor-pointer transition focus:outline-none focus-visible:underline ${
                            isTargeted
                              ? 'text-accent font-bold'
                              : 'text-text-tertiary group-hover:text-text-secondary'
                          }`}
                          aria-label={`Line ${lineNum}. Click to copy line.`}
                        >
                          {copiedLine === lineNum ? (
                            <MaterialIcon name="check" size={12} className="text-accent inline" aria-hidden="true" />
                          ) : (
                            lineNum
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Click to copy line {lineNum}</TooltipContent>
                    </Tooltip>
                  </td>

                  {/* Code Tokens Column */}
                  <td className="pl-4 pr-6 whitespace-pre font-mono text-xs leading-6 text-text-primary overflow-x-auto">
                    {lineTokens ? (
                      lineTokens.length > 0 ? (
                        lineTokens.map((t, tIdx) => (
                          <span
                            key={tIdx}
                            style={{
                              color: t.color || 'inherit',
                              fontStyle: t.fontStyle === 1 ? 'italic' : 'normal',
                            }}
                          >
                            {t.content}
                          </span>
                        ))
                      ) : (
                        ' '
                      )
                    ) : (
                      plainLine || ' '
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
