import * as React from 'react';
import { MaterialIcon } from '../ui/MaterialIcon';
import { ChatMessage, Citation } from '../../lib/types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CitationList } from './CitationList';
import { Button } from '../ui/button';
import { formatRelativeTime } from '../../lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface ChatMessageItemProps {
  message: ChatMessage;
  repoId: string;
  onSelectCitation: (citation: Citation) => void;
  selectedCitation?: Citation | null;
  onRegenerate?: () => void;
  isLatestAssistant?: boolean;
}

export function ChatMessageItem({
  message,
  repoId,
  onSelectCitation,
  selectedCitation,
  onRegenerate,
  isLatestAssistant = false,
}: ChatMessageItemProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyAnswer = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (message.role === 'user') {
    return (
      <div className="flex justify-end max-w-3xl mx-auto w-full my-4">
        <div className="rounded-[var(--radius-panel)] px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-border-strong)] text-[var(--color-text)] max-w-[85%] sm:max-w-[75%] shadow-sm">
          <p className="chat-user-bubble whitespace-pre-wrap select-text">
            {message.content}
          </p>
          <div className="mt-1.5 text-[10px] text-[var(--color-muted)] font-mono text-right select-none">
            {formatRelativeTime(message.created_at)}
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex gap-3 max-w-3xl mx-auto w-full my-6 select-text group">
        {/* Assistant Avatar */}
        <div
          className="h-7 w-7 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-mint-accent,#B9E4D0)] shrink-0 mt-0.5 select-none shadow-sm"
          aria-label="Codebase intelligence assistant"
        >
          <MaterialIcon name="smart_toy" size={17} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
        </div>

        {/* Assistant Content Stream */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Markdown Content */}
          <MarkdownRenderer content={message.content} />

          {/* Citations List */}
          <CitationList
            citations={message.citations || []}
            repoId={repoId}
            onSelectCitation={onSelectCitation}
            selectedCitation={selectedCitation}
          />

          {/* Actions Bar */}
          <div className="pt-2 flex items-center justify-between text-xs text-[var(--color-muted)] select-none">
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyAnswer}
                    className="h-6 px-2 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)] flex items-center gap-1"
                    aria-label="Copy full answer"
                  >
                    {copied ? (
                      <>
                        <MaterialIcon name="check" size={13} className="text-[var(--color-mint-accent,#B9E4D0)]" aria-hidden="true" />
                        <span className="text-[var(--color-mint-accent,#B9E4D0)] font-sans">Copied</span>
                      </>
                    ) : (
                      <>
                        <MaterialIcon name="content_copy" size={13} aria-hidden="true" />
                        <span className="font-sans">Copy answer</span>
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Copy markdown response
                </TooltipContent>
              </Tooltip>

              {isLatestAssistant && onRegenerate && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onRegenerate}
                      className="h-6 px-2 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-mint-accent,#B9E4D0)] flex items-center gap-1"
                      aria-label="Regenerate answer"
                    >
                      <MaterialIcon name="refresh" size={14} aria-hidden="true" />
                      <span className="font-sans">Regenerate</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Re-ask last prompt
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            <div className="text-[10px] font-mono text-[var(--color-muted)]">
              {formatRelativeTime(message.created_at)}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
