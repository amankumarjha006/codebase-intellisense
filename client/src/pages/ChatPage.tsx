import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { api } from '../lib/api';
import {
  Repository,
  Conversation,
  ChatMessage,
  Citation,
} from '../lib/types';
import { RepositoryHeader } from '../components/repository/RepositoryHeader';
import { SourcePanel } from '../components/chat/SourcePanel';
import { ConversationSidebar } from '../components/chat/ConversationSidebar';
import { ChatMessageItem } from '../components/chat/ChatMessageItem';
import { ChatComposer } from '../components/chat/ChatComposer';
import { ChatEmptyState } from '../components/chat/ChatEmptyState';
import { MarkdownRenderer } from '../components/chat/MarkdownRenderer';
import { CitationList } from '../components/chat/CitationList';
import { Button } from '../components/ui/button';
import { AnimatedPage } from '../components/ui/AnimatedPage';
import { LiveRegion } from '../components/ui/A11y';
import { shortSha } from '../lib/utils';

export function ChatPage() {
  const { id: repoId, conversationId } = useParams<{ id: string; conversationId?: string }>();
  const navigate = useNavigate();

  const [repository, setRepository] = React.useState<Repository | null>(null);
  const [repoFiles, setRepoFiles] = React.useState<string[]>([]);
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = React.useState(true);
  const [activeConvId, setActiveConvId] = React.useState<string | null>(conversationId || null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [inputText, setInputText] = React.useState('');
  const [streaming, setStreaming] = React.useState(false);
  const [streamedText, setStreamedText] = React.useState('');
  const [streamedCitations, setStreamedCitations] = React.useState<Citation[]>([]);
  const [selectedCitation, setSelectedCitation] = React.useState<Citation | null>(null);
  const [errorInfo, setErrorInfo] = React.useState<{ error_type: string; message: string; retry_after?: number } | null>(null);
  const [showScrollBottom, setShowScrollBottom] = React.useState(false);
  const [newerVersionDismissed, setNewerVersionDismissed] = React.useState(false);
  const [a11yStatus, setA11yStatus] = React.useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const isStreamingRef = React.useRef(false);
  const lastUserPromptRef = React.useRef<string>('');

  // Load repository details and conversations list
  const loadRepoAndConvs = React.useCallback(async () => {
    if (!repoId) return;
    try {
      const repo = await api.getRepository(repoId);
      setRepository(repo);

      setLoadingConversations(true);
      const convList = await api.getConversations(repoId);
      setConversations(convList);
      setLoadingConversations(false);

      if (!activeConvId && convList.length > 0 && convList[0]) {
        setActiveConvId(convList[0].id);
      }

      // Fetch repository files for dynamic starter suggestions
      try {
        const fileListRes = await api.getRepositoryFiles(repoId, 100, 0);
        if (fileListRes?.files) {
          setRepoFiles(fileListRes.files.map((f: { path: string }) => f.path));
        }
      } catch {
        // Fallback gracefully if files are unavailable
      }
    } catch {
      setLoadingConversations(false);
    }
  }, [repoId, activeConvId]);

  React.useEffect(() => {
    loadRepoAndConvs();
  }, [loadRepoAndConvs]);

  // Synchronize active conversation with route params
  React.useEffect(() => {
    if (conversationId && conversationId !== activeConvId) {
      setActiveConvId(conversationId);
    }
  }, [conversationId, activeConvId]);

  // Load messages when active conversation changes
  React.useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    if (isStreamingRef.current) return;

    setLoadingMessages(true);
    api.getMessages(activeConvId)
      .then((msgs: ChatMessage[]) => {
        if (!isStreamingRef.current) {
          setMessages(msgs);
          setLoadingMessages(false);
          scrollToBottom();
        }
      })
      .catch(() => {
        setLoadingMessages(false);
      });
  }, [activeConvId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    }, 50);
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 120;
    setShowScrollBottom(!isAtBottom);
  };

  const handleSelectConversation = (id: string) => {
    if (streaming) return;
    setActiveConvId(id);
    navigate(`/repositories/${repoId}/chat/${id}`);
    setMobileSidebarOpen(false);
  };

  const handleNewChat = async () => {
    if (!repoId || streaming) return;
    try {
      const conv = await api.createConversation(repoId, 'New exploration');
      setConversations((prev) => [conv, ...prev]);
      setActiveConvId(conv.id);
      setMessages([]);
      setErrorInfo(null);
      setStreamedText('');
      setStreamedCitations([]);
      navigate(`/repositories/${repoId}/chat/${conv.id}`);
      setMobileSidebarOpen(false);
    } catch {
      // Fallback
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await api.deleteConversation(id);
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);

      if (activeConvId === id) {
        if (remaining.length > 0 && remaining[0]) {
          setActiveConvId(remaining[0].id);
          navigate(`/repositories/${repoId}/chat/${remaining[0].id}`);
        } else {
          setActiveConvId(null);
          setMessages([]);
          navigate(`/repositories/${repoId}/chat`);
        }
      }
    } catch {
      // Ignore
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !repoId || streaming || isStreamingRef.current) return;

    lastUserPromptRef.current = text;
    let convId = activeConvId;

    if (!convId) {
      try {
        const newConv = await api.createConversation(repoId, text.slice(0, 42) + '...');
        setConversations((prev) => [newConv, ...prev]);
        convId = newConv.id;
        setActiveConvId(convId);
        navigate(`/repositories/${repoId}/chat/${convId}`, { replace: true });
      } catch {
        setErrorInfo({
          error_type: 'INITIALIZATION_ERROR',
          message: 'Failed to initialize conversation thread. Please check network connection.',
        });
        return;
      }
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
    setA11yStatus('Synthesizing verified answer from repository AST nodes...');
    scrollToBottom();

    isStreamingRef.current = true;
    try {
      await api.streamMessage(convId as string, text, {
        onToken: (tok: string) => {
          setStreamedText((prev) => prev + tok);
          scrollToBottom();
        },
        onCitation: (cit: Citation) => {
          setStreamedCitations((prev) => [...prev, cit]);
        },
        onError: (err: { error_type: string; message: string; retry_after?: number }) => {
          isStreamingRef.current = false;
          setErrorInfo(err);
          setStreaming(false);
          setA11yStatus(`Error: ${err.message}`);
        },
        onComplete: (completedMsg: ChatMessage) => {
          isStreamingRef.current = false;
          setMessages((prev) => [...prev, completedMsg]);
          setStreaming(false);
          setStreamedText('');
          setStreamedCitations([]);
          setA11yStatus('Response completed with verified code citations.');
          scrollToBottom();
        },
      });
    } catch (err: unknown) {
      isStreamingRef.current = false;
      setStreaming(false);
      setErrorInfo({
        error_type: 'STREAM_ERROR',
        message: err instanceof Error ? err.message : 'Communication error during answer synthesis.',
      });
    } finally {
      isStreamingRef.current = false;
    }
  };

  const handleStopStreaming = () => {
    isStreamingRef.current = false;
    setStreaming(false);
    if (streamedText.trim()) {
      const partialMsg: ChatMessage = {
        id: `partial_${Date.now()}`,
        conversation_id: activeConvId || '',
        role: 'assistant',
        content: streamedText + '\n\n*(Generation stopped by user)*',
        citations: streamedCitations,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, partialMsg]);
    }
    setStreamedText('');
    setStreamedCitations([]);
    setA11yStatus('Generation stopped.');
  };

  const handleRegenerateLast = () => {
    if (lastUserPromptRef.current) {
      handleSendMessage(lastUserPromptRef.current);
    } else {
      // Find the last user message
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      if (lastUser) {
        handleSendMessage(lastUser.content);
      }
    }
  };

  if (!repository) {
    return (
      <div
        role="status"
        aria-label="Loading repository"
        className="flex-1 flex flex-col items-center justify-center p-12 text-center text-xs text-[var(--color-muted)] space-y-3"
      >
        <MaterialIcon name="sync" size={24} spin className="text-[var(--color-mint-accent,#B9E4D0)]" aria-hidden="true" />
        <span>Loading codebase context...</span>
      </div>
    );
  }

  const isIndexing = repository.latest_job_status === 'INDEXING';
  const showNewerVersionBanner =
    !newerVersionDismissed && repository.latest_job_status === 'FAILED';

  const activeConversation = conversations.find((c) => c.id === activeConvId);

  return (
    <AnimatedPage className="flex flex-col h-full bg-[var(--color-page)] overflow-hidden">
      <LiveRegion message={a11yStatus} />
      <RepositoryHeader repository={repository} />

      {/* Newer version indexed notice */}
      {showNewerVersionBanner && (
        <div
          role="status"
          aria-label="Newer version indexed notice"
          className="px-6 py-2.5 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-secondary)] select-none shrink-0"
        >
          <div className="flex items-center gap-2">
            <MaterialIcon name="info" size={16} fill={1} color="var(--color-mint-accent, #B9E4D0)" aria-hidden="true" />
            <span>
              Pinned to repository commit{' '}
              <span className="font-mono text-[var(--color-text)]">
                {shortSha(repository.indexed_commit || repository.active_version_short_sha || '3a8f1c2')}
              </span>.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[11px]"
            onClick={() => setNewerVersionDismissed(true)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Indexing status notification */}
      {isIndexing && (
        <div
          role="status"
          aria-label="Repository is currently indexing"
          className="px-6 py-2 bg-[var(--color-warning-tint)] border-b border-[rgba(251,191,36,0.3)] text-xs text-[var(--color-warning)] flex items-center gap-2 select-none shrink-0"
        >
          <MaterialIcon name="sync" size={15} spin aria-hidden="true" />
          <span>
            Repository is currently indexing. Q&A answers will be verified as soon as AST chunking completes.
          </span>
        </div>
      )}

      {/* Main Chat Workspace: Sidebar + Conversation Feed + Source Drawer */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Left Sidebar: Conversation History */}
        <ConversationSidebar
          conversations={conversations}
          activeConvId={activeConvId}
          onSelectConv={handleSelectConversation}
          onNewChat={handleNewChat}
          onDeleteConv={handleDeleteConversation}
          loading={loadingConversations}
        />

        {/* Mobile Slide-over Drawer for Conversations */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden bg-black/60 backdrop-blur-xs">
            <div className="w-72 h-full bg-[var(--color-surface)] shadow-2xl flex flex-col">
              <div className="p-3 border-b border-[var(--color-border)] flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--color-text)]">Conversations</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setMobileSidebarOpen(false)}
                  aria-label="Close conversation drawer"
                >
                  <MaterialIcon name="close" size={18} aria-hidden="true" />
                </Button>
              </div>
              <ConversationSidebar
                conversations={conversations}
                activeConvId={activeConvId}
                onSelectConv={handleSelectConversation}
                onNewChat={handleNewChat}
                onDeleteConv={handleDeleteConversation}
                loading={loadingConversations}
              />
            </div>
            <div className="flex-1" onClick={() => setMobileSidebarOpen(false)} />
          </div>
        )}

        {/* Center Chat Viewport & Messages */}
        <main
          id="main-content"
          aria-label="Conversation workspace"
          className="flex-1 flex flex-col overflow-hidden relative bg-[var(--color-page)]"
        >
          {/* Chat Workspace Subheader: Title, Revision context & Controls */}
          <div className="px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-xs flex items-center justify-between gap-3 text-xs shrink-0 select-none">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Mobile button to open history */}
              <Button
                variant="ghost"
                size="icon-sm"
                className="md:hidden text-[var(--color-text-secondary)]"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Open conversation history"
              >
                <MaterialIcon name="menu" size={18} aria-hidden="true" />
              </Button>

              <div className="min-w-0 flex items-center gap-2">
                <MaterialIcon name="chat" size={16} fill={1} color="var(--color-mint-accent, #B9E4D0)" className="shrink-0" aria-hidden="true" />
                <span className="font-semibold text-[var(--color-text)] truncate max-w-xs sm:max-w-md">
                  {activeConversation?.title || 'Codebase Q&A'}
                </span>
                <span className="text-[var(--color-border)] hidden sm:inline" aria-hidden="true">•</span>
                <span className="text-[11px] font-mono text-[var(--color-muted)] hidden sm:inline">
                  commit {shortSha(repository.indexed_commit || repository.active_version_short_sha || '3a8f1c2')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleNewChat}
                className="h-7 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-mint-accent,#B9E4D0)] hover:bg-[var(--color-raised)] gap-1.5 hidden sm:flex"
                aria-label="Start new conversation"
              >
                <MaterialIcon name="add" size={16} aria-hidden="true" />
                <span>New question</span>
              </Button>

              {activeConvId && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteConversation(activeConvId)}
                  className="h-7 w-7 p-0 text-[var(--color-muted)] hover:text-[var(--color-error)]"
                  title="Delete current conversation"
                  aria-label="Delete current conversation"
                >
                  <MaterialIcon name="delete" size={15} aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            role="log"
            aria-label="Chat messages thread"
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 no-scrollbar"
          >
            {/* Loading state for messages */}
            {loadingMessages && (
              <div className="max-w-3xl mx-auto py-12 space-y-4">
                <div className="h-16 w-3/4 rounded-[var(--radius-panel)] bg-[var(--color-raised)] animate-pulse" />
                <div className="h-28 w-5/6 rounded-[var(--radius-panel)] bg-[var(--color-raised)] animate-pulse" />
              </div>
            )}

            {/* Empty State / Suggested Questions */}
            {!loadingMessages && messages.length === 0 && !streaming && (
              <ChatEmptyState
                repository={repository}
                repoFiles={repoFiles}
                onSelectSuggestion={(q) => handleSendMessage(q)}
              />
            )}

            {/* Rendered Messages List */}
            {!loadingMessages &&
              messages.map((msg, index) => {
                const isLatestAssistant =
                  msg.role === 'assistant' &&
                  index === messages.length - 1 &&
                  !streaming;

                return (
                  <ChatMessageItem
                    key={msg.id}
                    message={msg}
                    repoId={repository.id}
                    onSelectCitation={(c) => setSelectedCitation(c)}
                    selectedCitation={selectedCitation}
                    onRegenerate={isLatestAssistant ? handleRegenerateLast : undefined}
                    isLatestAssistant={isLatestAssistant}
                  />
                );
              })}

            {/* Live Streaming Message Display */}
            {streaming && (
              <div className="flex gap-3 max-w-3xl mx-auto w-full my-6 select-text" aria-live="polite">
                <div
                  className="h-7 w-7 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-mint-accent,#B9E4D0)] shrink-0 mt-0.5 shadow-sm"
                  aria-label="Assistant generating"
                >
                  <MaterialIcon
                    name="smart_toy"
                    size={17}
                    fill={1}
                    color="var(--color-mint-accent, #B9E4D0)"
                    className="animate-pulse"
                    aria-hidden="true"
                  />
                </div>

                <div className="flex-1 min-w-0 space-y-3">
                  <div className="relative">
                    <MarkdownRenderer content={streamedText || 'Searching AST symbols & synthesizing response...'} />
                    <span className="inline-block w-1.5 h-3.5 bg-[var(--color-mint-accent,#B9E4D0)] animate-pulse ml-0.5 align-middle" />
                  </div>

                  {streamedCitations.length > 0 && (
                    <CitationList
                      citations={streamedCitations}
                      repoId={repository.id}
                      onSelectCitation={(c) => setSelectedCitation(c)}
                      selectedCitation={selectedCitation}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Error Message & Retry Action */}
            {errorInfo && (
              <div
                role="alert"
                aria-live="assertive"
                className="max-w-3xl mx-auto p-4 rounded-[var(--radius-panel)] border border-[var(--color-error-border)] bg-[var(--color-error-tint)] text-xs text-[var(--color-error)] space-y-2.5 my-4"
              >
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <MaterialIcon name="error" size={18} fill={1} aria-hidden="true" />
                  <span>Answer synthesis failed</span>
                </div>
                <p className="text-xs text-[var(--color-text)] leading-relaxed">
                  {errorInfo.message}
                </p>
                {errorInfo.retry_after && (
                  <p className="text-[11px] font-mono text-[var(--color-muted)]">
                    Rate limited. Please retry in {errorInfo.retry_after} seconds.
                  </p>
                )}
                <div className="pt-1 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSendMessage(lastUserPromptRef.current)}
                    className="border-[var(--color-error-border)] text-[var(--color-error)] hover:bg-[var(--color-error-tint)] gap-1.5 text-xs h-7"
                  >
                    <MaterialIcon name="restart_alt" size={15} aria-hidden="true" />
                    <span>Retry Question</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setErrorInfo(null)}
                    className="text-xs h-7 text-[var(--color-muted)] hover:text-[var(--color-text)]"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Jump to bottom button when user scrolls up */}
          {showScrollBottom && (
            <button
              onClick={scrollToBottom}
              aria-label="Jump to latest message"
              className="absolute bottom-24 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border-strong)] text-xs text-[var(--color-text)] shadow-xl flex items-center gap-1.5 hover:bg-[var(--color-raised)] hover:border-[var(--color-mint-accent,#B9E4D0)] transition z-10"
            >
              <MaterialIcon name="arrow_downward" size={15} className="text-[var(--color-mint-accent,#B9E4D0)]" aria-hidden="true" />
              <span>Jump to latest</span>
            </button>
          )}

          {/* Fixed Bottom Message Composer */}
          <ChatComposer
            inputText={inputText}
            setInputText={setInputText}
            onSendMessage={handleSendMessage}
            onStopStreaming={handleStopStreaming}
            streaming={streaming}
            disabled={isIndexing}
            placeholder={
              isIndexing
                ? 'Repository is indexing AST embeddings. Chat will activate once indexing finishes...'
                : `Ask about architecture, functions, or data flow in ${repository.name}...`
            }
          />
        </main>

        {/* Right Drawer: Source Code Citation Inspector */}
        {selectedCitation && (
          <SourcePanel
            citation={selectedCitation}
            repoId={repository.id}
            onClose={() => setSelectedCitation(null)}
          />
        )}
      </div>
    </AnimatedPage>
  );
}
