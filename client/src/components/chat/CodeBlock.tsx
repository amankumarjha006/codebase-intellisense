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
          if (!cancelled) {
            setHighlightedHtml(null);
          }
        }
      })
      .catch(() => {
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
    <div className="my-3 rounded-lg border border-white/10 bg-surface-raised overflow-hidden text-xs font-mono shadow-xs">
      {/* Code Block Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-surface-base/50 text-[11px] text-text-tertiary">
        <div className="flex items-center gap-1.5 font-sans font-medium text-text-secondary">
          <MaterialIcon name="terminal" size={13} className="text-accent" />
          <span className="uppercase tracking-wider text-[10px] font-mono">{cleanLang}</span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 px-1.5 text-[11px] text-text-tertiary hover:text-text-primary gap-1"
          aria-label={copied ? 'Copied code to clipboard' : 'Copy code to clipboard'}
        >
          <MaterialIcon name={copied ? 'check' : 'content_copy'} size={12} className={copied ? 'text-accent' : ''} />
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </Button>
      </div>

      {/* Code Body */}
      {highlightedHtml ? (
        <div
          className="p-3 overflow-x-auto text-xs leading-5 no-scrollbar [&>pre]:!bg-transparent [&>pre]:!p-0 [&>pre]:!m-0 [&>pre]:!border-0 font-mono bg-surface-base"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        <pre className="p-3 overflow-x-auto text-xs leading-5 text-text-primary font-mono whitespace-pre no-scrollbar bg-surface-base">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
