import * as React from 'react';
import { MaterialIcon } from '../ui/MaterialIcon';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';

interface ChatComposerProps {
  inputText: string;
  setInputText: (text: string) => void;
  onSendMessage: (text?: string) => void;
  onStopStreaming: () => void;
  streaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatComposer({
  inputText,
  setInputText,
  onSendMessage,
  onStopStreaming,
  streaming,
  disabled = false,
  placeholder = 'Ask a question about this codebase... (Enter to send, Shift+Enter for newline)',
}: ChatComposerProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!streaming && inputText.trim() && !disabled) {
        onSendMessage();
      }
    } else if (e.key === 'Escape') {
      textareaRef.current?.blur();
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!streaming && inputText.trim() && !disabled) {
      onSendMessage();
    }
  };

  const isSendDisabled = !inputText.trim() || streaming || disabled;

  return (
    <div className="p-3 sm:p-4 border-t border-white/10 bg-surface-raised">
      <form
        onSubmit={handleFormSubmit}
        className="max-w-3xl mx-auto rounded-lg border border-white/10 bg-surface-base focus-within:ring-1 focus-within:ring-accent transition-all overflow-hidden"
      >
        <Textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          aria-label="Ask a question about this codebase"
          className="min-h-[64px] max-h-32 border-0 bg-transparent resize-none p-3 text-xs sm:text-[13px] text-text-primary placeholder:text-text-tertiary focus-visible:ring-0 rounded-none leading-relaxed"
        />

        {/* Composer bottom bar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-white/5 bg-surface-raised/40 text-[11px] text-text-tertiary select-none">
          <div className="flex items-center gap-2 font-mono text-[10px] sm:text-[11px]">
            <span className="hidden sm:inline">↵ send</span>
            <span className="hidden sm:inline text-white/10">·</span>
            <span className="hidden sm:inline">Shift+↵ newline</span>
          </div>

          <div className="flex items-center gap-2">
            {streaming ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onStopStreaming}
                className="h-7 px-2.5 text-xs flex items-center gap-1.5 text-status-red hover:bg-status-red/10 border border-status-red/20"
                aria-label="Stop generating response"
              >
                <MaterialIcon name="stop" size={14} className="text-status-red" />
                <span>Stop</span>
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                variant="primary"
                disabled={isSendDisabled}
                className="h-7 px-3 text-xs flex items-center gap-1"
                aria-label="Send message"
              >
                <span>Ask</span>
                <MaterialIcon name="arrow_upward" size={13} />
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
