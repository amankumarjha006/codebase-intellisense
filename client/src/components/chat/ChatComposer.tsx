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
  placeholder = 'Ask a question about this repository... (Enter to send, Shift+Enter for newline)',
}: ChatComposerProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!streaming && inputText.trim() && !disabled) {
        onSendMessage();
      }
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
    <div className="p-3 sm:p-4 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <form
        onSubmit={handleFormSubmit}
        className="max-w-3xl mx-auto rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-page)] focus-within:border-[var(--color-mint-accent,#B9E4D0)] transition-colors shadow-sm overflow-hidden"
      >
        <Textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          aria-label="Ask a question about this codebase"
          className="min-h-[72px] max-h-36 border-0 bg-transparent resize-none p-3.5 text-xs sm:text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus-visible:ring-0 rounded-none"
        />

        {/* Composer bottom bar */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--color-border)]/50 bg-[var(--color-raised)]/30 text-[11px] text-[var(--color-muted)] select-none">
          <div className="flex items-center gap-2 font-mono text-[10px] sm:text-[11px] text-[var(--color-muted)]">
            <span>Enter to send, Shift+Enter for newline</span>
          </div>

          <div className="flex items-center gap-2">
            {streaming ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={onStopStreaming}
                className="h-7 px-3 text-xs flex items-center gap-1.5 border-[var(--color-border)] hover:bg-[var(--color-raised)]"
                aria-label="Stop generating response"
              >
                <MaterialIcon name="stop_circle" size={15} fill={1} className="text-[var(--color-error)]" aria-hidden="true" />
                <span>Stop</span>
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                variant="primary"
                disabled={isSendDisabled}
                className="h-7 px-3.5 text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Send message to codebase intelligence"
              >
                <span>Send</span>
                <MaterialIcon name="send" size={14} fill={1} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
