import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  FileCode,
  AlertCircle,
  ArrowDown,
  RotateCcw,
  StopCircle,
  Loader2,
  GitBranch,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  Repository,
  Conversation,
  ChatMessage,
  Citation,
} from '../lib/types';
import { mockSuggestedQuestions } from '../mock/data';
import { getStoredScenarios } from '../lib/scenarios';
import { formatRelativeTime } from '../lib/utils';
import { RepositoryHeader } from '../components/repository/RepositoryHeader';
import { SourcePanel } from '../components/chat/SourcePanel';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/input';

export function ChatPage() {
  const { id: repoId, conversationId } = useParams<{ id: string; conversationId?: string }>();
  const navigate = useNavigate();

  const [repository, setRepository] = React.useState<Repository | null>(null);
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = React.useState<string | null>(conversationId || null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [inputText, setInputText] = React.useState('');
  const [streaming, setStreaming] = React.useState(false);
  const [streamedText, setStreamedText] = React.useState('');
  const [streamedCitations, setStreamedCitations] = React.useState<Citation[]>([]);
  const [selectedCitation, setSelectedCitation] = React.useState<Citation | null>(null);
  const [errorInfo, setErrorInfo] = React.useState<{ error_type: string; message: string; retry_after?: number } | null>(null);
  const [showScrollBottom, setShowScrollBottom] = React.useState(false);
  const [newerVersionDismissed, setNewerVersionDismissed] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const scenarios = getStoredScenarios();

  // Load repo and conversations
  const loadRepoAndConvs = React.useCallback(async () => {
    if (!repoId) return;
    try {
      const repo = await api.getRepository(repoId);
      setRepository(repo);
      const convList = await api.getConversations(repoId);
      setConversations(convList);

      if (!activeConvId && convList.length > 0 && convList[0]) {
        setActiveConvId(convList[0].id);
      }
    } catch {
      // Ignore
    }
  }, [repoId, activeConvId]);

  React.useEffect(() => {
    loadRepoAndConvs();
  }, [loadRepoAndConvs]);

  // Load messages when active conversation changes
  React.useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    api.getMessages(activeConvId).then((msgs: ChatMessage[]) => {
      setMessages(msgs);
      scrollToBottom();
    });
  }, [activeConvId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 50);
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollBottom(!isAtBottom);
  };

  const handleNewChat = async () => {
    if (!repoId) return;
    const conv = await api.createConversation(repoId, 'New question');
    setConversations([conv, ...conversations]);
    setActiveConvId(conv.id);
    navigate(`/repositories/${repoId}/chat/${conv.id}`);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || !repoId || streaming) return;

    let convId = activeConvId;
    if (!convId) {
      const newConv = await api.createConversation(repoId, text.slice(0, 36) + '...');
      setConversations([newConv, ...conversations]);
      convId = newConv.id;
      setActiveConvId(convId);
      navigate(`/repositories/${repoId}/chat/${convId}`);
    }

    // Append user message immediately
    const userMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      conversation_id: convId as string,
      role: 'user',
      content: text,
      citations: [],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setStreaming(true);
    setStreamedText('');
    setStreamedCitations([]);
    setErrorInfo(null);
    scrollToBottom();

    await api.streamMessage(convId as string, text, {
      onToken: (tok: string) => {
        setStreamedText((prev) => prev + tok);
        scrollToBottom();
      },
      onCitation: (cit: Citation) => {
        setStreamedCitations((prev) => [...prev, cit]);
      },
      onError: (err: { error_type: string; message: string; retry_after?: number }) => {
        setErrorInfo(err);
        setStreaming(false);
      },
      onComplete: (completedMsg: ChatMessage) => {
        setMessages((prev) => [...prev, completedMsg]);
        setStreaming(false);
        setStreamedText('');
        setStreamedCitations([]);
        scrollToBottom();
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!repository) {
    return <div className="p-8 text-center text-xs text-[var(--color-muted)]">Loading repository...</div>;
  }

  const isIndexing = repository.latest_job_status === 'INDEXING';
  const showNewerVersionBanner =
    !newerVersionDismissed && (scenarios.chat === 'newer_version' || repository.latest_job_status === 'FAILED');

  return (
    <div className="flex flex-col h-full bg-[var(--color-page)]">
      <RepositoryHeader repository={repository} />

      {/* Newer version banner */}
      {showNewerVersionBanner && (
        <div className="px-6 py-2.5 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
          <div className="flex items-center gap-2">
            <GitBranch size={14} className="text-[var(--color-accent)] shrink-0" />
            <span>
              A newer version of this repository is indexed. Your conversation is pinned to commit{' '}
              <span className="font-mono text-[var(--color-text)]">
                {repository.active_version_short_sha || '3a8f1c2'}
              </span>.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setNewerVersionDismissed(true)}
            >
              Switch to latest
            </Button>
          </div>
        </div>
      )}

      {/* Repository not ready alert */}
      {isIndexing && (
        <div className="px-6 py-2 bg-[var(--color-warning-tint)] border-b border-[rgba(251,191,36,0.3)] text-xs text-[var(--color-warning)] flex items-center gap-2">
          <Loader2 size={13} className="animate-spin" />
          <span>
            Repository is currently indexing. Q&A answers will be grounded as soon as AST embeddings complete.
          </span>
        </div>
      )}

      {/* Main Chat Split: Sidebar + Messages + Source Panel */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left: Conversation History */}
        <div className="w-64 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col shrink-0 hidden md:flex">
          <div className="p-3 border-b border-[var(--color-border)]">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleNewChat}
              className="w-full justify-start gap-2"
            >
              <Plus size={14} />
              <span>New question</span>
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar">
            {conversations.map((conv) => {
              const active = conv.id === activeConvId;
              return (
                <button
                  key={conv.id}
                  onClick={() => {
                    setActiveConvId(conv.id);
                    navigate(`/repositories/${repoId}/chat/${conv.id}`);
                  }}
                  className={`w-full flex items-start gap-2.5 p-2 rounded-[var(--radius-control)] text-left text-xs transition ${
                    active
                      ? 'bg-[var(--color-raised)] text-[var(--color-text)] border border-[var(--color-border-strong)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-raised)]/60 hover:text-[var(--color-text)]'
                  }`}
                >
                  <MessageSquare size={14} className="mt-0.5 shrink-0 text-[var(--color-muted)]" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{conv.title}</div>
                    <div className="text-[10px] text-[var(--color-muted)] font-mono mt-0.5">
                      {formatRelativeTime(conv.updated_at)} • {conv.pinned_sha}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: Messages Thread & Composer */}
        <div className="flex-1 flex flex-col overflow-hidden relative bg-[var(--color-page)]">
          {/* Messages viewport */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6"
          >
            {/* Empty State / Suggested Questions if no messages */}
            {messages.length === 0 && !streaming && (
              <div className="max-w-2xl mx-auto py-12 text-center space-y-6">
                <div className="h-12 w-12 rounded-xl bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)] mx-auto">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text)]">
                    Ask anything about {repository.name}
                  </h2>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-md mx-auto">
                    Every answer is synthesized against Tree-sitter AST nodes and cited to verifiable line ranges in commit <span className="font-mono text-[var(--color-text)]">{repository.active_version_short_sha || '3a8f1c2'}</span>.
                  </p>
                </div>

                {/* Suggested Questions Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
                  {mockSuggestedQuestions.map((sq, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(sq.question)}
                      className="p-3.5 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)] hover:bg-[var(--color-raised)]/60 transition text-xs space-y-1.5 group"
                    >
                      <div className="font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                        {sq.question}
                      </div>
                      <div className="text-[11px] font-mono text-[var(--color-muted)] truncate">
                        {sq.file_hint}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Rendered Messages */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl mx-auto ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="h-7 w-7 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)] shrink-0 mt-0.5">
                    <Sparkles size={14} />
                  </div>
                )}

                <div
                  className={`rounded-[var(--radius-panel)] p-4 text-xs sm:text-sm leading-relaxed max-w-[85%] ${
                    msg.role === 'user'
                      ? 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]'
                      : 'bg-transparent text-[var(--color-text)] space-y-3'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <>
                      <div className="prose prose-invert prose-xs max-w-none space-y-2">
                        <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                      </div>

                      {/* Citations */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)]/60">
                          <span className="text-[11px] text-[var(--color-muted)] font-medium">
                            Citations:
                          </span>
                          {msg.citations.map((c, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedCitation(c)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border border-[var(--color-accent-border)] bg-[var(--color-accent-tint)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition"
                            >
                              <FileCode size={12} />
                              <span>
                                {c.path.split('/').pop()}:{c.start_line}–{c.end_line}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Live Streaming Assistant Message */}
            {streaming && (
              <div className="flex gap-3 max-w-3xl mx-auto justify-start">
                <div className="h-7 w-7 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)] shrink-0 mt-0.5">
                  <Sparkles size={14} className="animate-spin" />
                </div>
                <div className="rounded-[var(--radius-panel)] p-4 text-xs sm:text-sm leading-relaxed max-w-[85%] space-y-3">
                  <div className="prose prose-invert prose-xs max-w-none">
                    <Markdown remarkPlugins={[remarkGfm]}>{streamedText}</Markdown>
                    <span className="inline-block w-1.5 h-3.5 bg-[var(--color-accent)] animate-pulse ml-0.5 align-middle" />
                  </div>

                  {streamedCitations.length > 0 && (
                    <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)]/60">
                      <span className="text-[11px] text-[var(--color-muted)] font-medium">
                        Citations:
                      </span>
                      {streamedCitations.map((c, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedCitation(c)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border border-[var(--color-accent-border)] bg-[var(--color-accent-tint)] text-[var(--color-accent)]"
                        >
                          <FileCode size={12} />
                          <span>
                            {c.path.split('/').pop()}:{c.start_line}–{c.end_line}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Message Display */}
            {errorInfo && (
              <div className="max-w-2xl mx-auto p-4 rounded-[var(--radius-panel)] border border-[var(--color-error-border)] bg-[var(--color-error-tint)] text-xs text-[var(--color-error)] space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle size={15} />
                  <span>{errorInfo.message}</span>
                </div>
                {errorInfo.retry_after && (
                  <p className="text-[11px] text-[var(--color-muted)]">
                    Please wait {errorInfo.retry_after} seconds before requesting another synthesis.
                  </p>
                )}
                <div className="pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSendMessage()}
                    className="border-[var(--color-error-border)] text-[var(--color-error)] hover:bg-[var(--color-error-tint)]"
                  >
                    <RotateCcw size={12} />
                    <span>Retry question</span>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Jump to latest button */}
          {showScrollBottom && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-20 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[var(--color-raised)] border border-[var(--color-border-strong)] text-xs text-[var(--color-text)] shadow-lg flex items-center gap-1.5 hover:bg-[var(--color-surface)] transition"
            >
              <ArrowDown size={13} />
              <span>Jump to latest</span>
            </button>
          )}

          {/* Composer */}
          <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="max-w-3xl mx-auto relative rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-page)] focus-within:border-[var(--color-accent)] transition-colors shadow-inner">
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about this repository's functions, architecture, or flow... (Enter to send, Shift+Enter for newline)"
                className="min-h-[72px] max-h-36 border-0 bg-transparent resize-none p-3 text-xs sm:text-sm focus-visible:ring-0"
              />
              <div className="flex items-center justify-between p-2 pt-0 text-[11px] text-[var(--color-muted)]">
                <span className="font-mono hidden sm:inline">
                  Pinned commit: {repository.active_version_short_sha || '3a8f1c2'}
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  {streaming ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setStreaming(false)}
                      className="h-7 text-xs"
                    >
                      <StopCircle size={13} />
                      <span>Stop</span>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleSendMessage()}
                      disabled={!inputText.trim()}
                      className="h-7 px-3 text-xs"
                    >
                      <span>Send</span>
                      <Send size={12} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Source Panel */}
        {selectedCitation && (
          <SourcePanel
            citation={selectedCitation}
            repoId={repository.id}
            onClose={() => setSelectedCitation(null)}
          />
        )}
      </div>
    </div>
  );
}
