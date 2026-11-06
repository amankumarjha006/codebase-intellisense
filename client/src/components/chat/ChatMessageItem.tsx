import * as React from 'react';
import { motion } from 'motion/react';
import { MaterialIcon } from '../ui/MaterialIcon';
import { ChatMessage, Citation } from '../../lib/types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CitationList } from './CitationList';
import { Button } from '../ui/button';
import { formatRelativeTime } from '../../lib/utils';
import { toast } from '../ui/sonner';

interface ChatMessageItemProps {
  message: ChatMessage;
  repoId: string;
  onSelectCitation: (citation: Citation) => void;
  selectedCitation?: Citation | null;
}

export function ChatMessageItem({
  message,
  repoId,
  onSelectCitation,
  selectedCitation,
}: ChatMessageItemProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyAnswer = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast.success('Answer copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (message.role === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="flex justify-end max-w-3xl mx-auto w-full my-3 px-4"
      >
        <div className="rounded-lg px-3.5 py-2.5 bg-surface-raised border border-white/10 text-text-primary max-w-[85%] sm:max-w-[75%] space-y-1 shadow-xs">
          <p className="text-xs whitespace-pre-wrap leading-relaxed select-text font-sans">
            {message.content}
          </p>
          <div className="text-[10px] text-text-tertiary tabular-nums font-mono text-right select-none">
            {formatRelativeTime(message.created_at)}
          </div>
        </div>
      </motion.div>
    );
  }

  // Assistant message
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="flex gap-3 max-w-3xl mx-auto w-full my-5 px-4 select-text group"
    >
      {/* Assistant Avatar */}
      <div
        className="h-6 w-6 rounded bg-surface-overlay border border-white/10 flex items-center justify-center text-accent shrink-0 mt-0.5 select-none"
        aria-label="Assistant"
      >
        <MaterialIcon name="smart_toy" size={14} />
      </div>

      {/* Content Stream */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Markdown Content */}
        <MarkdownRenderer
          content={message.content}
          citations={message.citations || []}
          onSelectCitation={onSelectCitation}
        />

        {/* Citations List */}
        <CitationList
          citations={message.citations || []}
          repoId={repoId}
          onSelectCitation={onSelectCitation}
          selectedCitation={selectedCitation}
        />

        {/* Message Actions */}
        <div className="pt-1 flex items-center justify-between text-xs text-text-tertiary select-none">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyAnswer}
            className="h-6 px-1.5 text-[11px] text-text-tertiary hover:text-text-primary gap-1"
            aria-label="Copy answer"
          >
            <MaterialIcon name={copied ? 'check' : 'content_copy'} size={12} className={copied ? 'text-accent' : ''} />
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </Button>

          <span className="text-[10px] font-mono tabular-nums">
            {formatRelativeTime(message.created_at)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
