import * as React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="chat-prose select-text space-y-3">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && !String(children).includes('\n');

            if (isInline) {
              return (
                <code
                  className="chat-inline-code"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            const codeString = String(children).replace(/\n$/, '');
            const language = match ? match[1] : '';

            return <CodeBlock code={codeString} language={language} />;
          },
          p({ children }) {
            return <p className="mb-2.5 last:mb-0 leading-[1.72] text-[var(--color-text)]">{children}</p>;
          },
          h1({ children }) {
            return (
              <h1 className="text-base sm:text-[17px] font-semibold tracking-tight text-[var(--color-text)] mt-4 mb-2 border-b border-[var(--color-border)]/60 pb-1.5">
                {children}
              </h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="text-sm sm:text-[15px] font-semibold tracking-tight text-[var(--color-text)] mt-3.5 mb-1.5">
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="text-xs sm:text-[13px] font-semibold text-[var(--color-mint-accent,#B9E4D0)] uppercase tracking-wider mt-3 mb-1 font-mono">
                {children}
              </h3>
            );
          },
          ul({ children }) {
            return <ul className="list-disc list-outside pl-4 space-y-1 mb-2.5 text-[var(--color-text)]">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-outside pl-4 space-y-1 mb-2.5 text-[var(--color-text)]">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed pl-0.5">{children}</li>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l border-[var(--color-border-strong)] bg-[var(--color-raised)]/20 pl-3.5 pr-2 py-1.5 rounded-r my-2.5 text-xs text-[var(--color-text-secondary)] italic">
                {children}
              </blockquote>
            );
          },
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
                <table className="w-full text-xs text-left border-collapse">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-[var(--color-raised)]/70 text-[var(--color-mint-accent,#B9E4D0)] border-b border-[var(--color-border)]">{children}</thead>;
          },
          tbody({ children }) {
            return <tbody className="divide-y divide-[var(--color-border)]/50">{children}</tbody>;
          },
          tr({ children }) {
            return <tr className="hover:bg-[var(--color-raised)]/20 transition-colors">{children}</tr>;
          },
          th({ children }) {
            return <th className="px-3.5 py-2 font-medium text-[11px] font-mono uppercase tracking-wider">{children}</th>;
          },
          td({ children }) {
            return <td className="px-3.5 py-2 text-[var(--color-text)] font-sans">{children}</td>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[var(--color-mint-accent,#B9E4D0)] underline underline-offset-2 hover:opacity-80 transition-opacity"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
