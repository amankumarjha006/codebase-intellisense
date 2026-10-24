import * as React from 'react';
import { MaterialIcon } from '../ui/MaterialIcon';
import { Button } from '../ui/button';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = 'text' }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);
  const [highlightedHtml, setHighlightedHtml] = React.useState<string | null>(null);

  const cleanLang = (language || 'text').toLowerCase().replace(/^language-/, '');

  React.useEffect(() => {
    let cancelled = false;

    // Dynamically load shiki to avoid blocking initial render
    import('shiki')
      .then(async (shiki) => {
        try {
          const html = await shiki.codeToHtml(code, {
            lang: cleanLang || 'text',
            theme: 'github-dark',
          });
          if (!cancelled) {
            setHighlightedHtml(html);
          }
        } catch {
          // If the language is unsupported or fails, fall back to plain text
          if (!cancelled) {
            setHighlightedHtml(null);
          }
        }
      })
      .catch(() => {
        // Fallback gracefully
        if (!cancelled) {
          setHighlightedHtml(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, cleanLang]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[#121211] overflow-hidden text-xs font-mono shadow-sm">
      {/* Code Block Header */}
      <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-raised)]/60 text-[11px] text-[var(--color-muted)]">
        <div className="flex items-center gap-1.5 font-sans font-medium text-[var(--color-text-secondary)]">
          <MaterialIcon name="terminal" size={14} className="text-[var(--color-mint-accent,#B9E4D0)]" aria-hidden="true" />
          <span className="uppercase tracking-wider text-[10px] font-mono">{cleanLang}</span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 px-2 text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] flex items-center gap-1"
          aria-label={copied ? 'Copied code to clipboard' : 'Copy code to clipboard'}
        >
          {copied ? (
            <>
              <MaterialIcon name="check" size={14} className="text-[var(--color-mint-accent,#B9E4D0)]" aria-hidden="true" />
              <span className="text-[var(--color-mint-accent,#B9E4D0)] font-sans">Copied</span>
            </>
          ) : (
            <>
              <MaterialIcon name="content_copy" size={14} aria-hidden="true" />
              <span className="font-sans">Copy</span>
            </>
          )}
        </Button>
      </div>

      {/* Code Body */}
      {highlightedHtml ? (
        <div
          className="p-3.5 overflow-x-auto text-xs leading-5 no-scrollbar [&>pre]:!bg-transparent [&>pre]:!p-0 [&>pre]:!m-0 [&>pre]:!border-0 font-mono"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        <pre className="p-3.5 overflow-x-auto text-xs leading-5 text-[var(--color-text)] font-mono whitespace-pre no-scrollbar">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
