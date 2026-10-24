import * as React from 'react';
import { MaterialIcon } from '../ui/MaterialIcon';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

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
  const [copiedAll, setCopiedAll] = React.useState(false);
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
            lang: cleanLang as any,
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
    setTimeout(() => setCopiedLine(null), 1500);
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(code);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const hasTarget = Boolean(targetStartLine && targetStartLine > 0);
  const displayEnd = targetEndLine && targetEndLine >= (targetStartLine || 1) ? targetEndLine : targetStartLine;

  const totalLines = tokens ? tokens.length : rawLines.length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--color-page)] select-text">
      {/* Targeted Line Range Banner (if navigated from citation or search) */}
      {hasTarget && (
        <div
          role="status"
          aria-live="polite"
          className="px-4 py-2 bg-[var(--color-mint-selected-bg,#253A32)] border-b border-[rgba(185,228,208,0.25)] flex items-center justify-between text-xs select-none shrink-0"
        >
          <div className="flex items-center gap-2 text-[var(--color-mint-accent,#B9E4D0)] font-medium">
            <MaterialIcon name="pin_drop" size={16} fill={1} aria-hidden="true" />
            <span>
              Targeted line reference: {targetStartLine}
              {displayEnd && displayEnd !== targetStartLine ? `–${displayEnd}` : ''}
            </span>
            <span className="text-[10px] text-[var(--color-muted)] font-mono">
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
              className="h-6 px-2 text-[11px] text-[var(--color-mint-accent,#B9E4D0)] hover:bg-[var(--color-mint-accent,#B9E4D0)]/20"
              aria-label="Scroll to highlighted lines"
            >
              Scroll to Lines
            </Button>
            {onClearTarget && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearTarget}
                className="h-6 px-2 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)]"
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
        className="flex-1 overflow-auto p-2 sm:p-4 font-mono text-xs leading-6 bg-[var(--color-page)] focus:outline-none"
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
                      ? 'bg-[var(--color-mint-selected-bg,#253A32)]/80 border-l-2 border-[var(--color-mint-accent,#B9E4D0)]'
                      : 'hover:bg-[var(--color-raised)]/40 border-l-2 border-transparent'
                  }`}
                >
                  {/* Line Number Column */}
                  <td className="w-12 select-none pr-3 pl-2 text-right text-[11px] font-mono border-r border-[var(--color-border)]/40 shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleCopyLine(lineNum, plainLine)}
                          className={`cursor-pointer transition ${
                            isTargeted
                              ? 'text-[var(--color-mint-accent,#B9E4D0)] font-bold'
                              : 'text-[var(--color-muted)] group-hover:text-[var(--color-text-secondary)]'
                          }`}
                          aria-label={`Line ${lineNum}. Click to copy line.`}
                        >
                          {copiedLine === lineNum ? (
                            <MaterialIcon name="check" size={12} fill={1} className="text-[var(--color-mint-accent,#B9E4D0)] inline" aria-hidden="true" />
                          ) : (
                            lineNum
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Click to copy line {lineNum}</TooltipContent>
                    </Tooltip>
                  </td>

                  {/* Code Tokens Column */}
                  <td className="pl-4 pr-6 whitespace-pre font-mono text-xs leading-6 text-[var(--color-text)] overflow-x-auto">
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
