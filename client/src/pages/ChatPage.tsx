import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { Button } from '../components/ui/button';
import { AnimatedPage } from '../components/ui/AnimatedPage';
import { RepositoryHeader } from '../components/repository/RepositoryHeader';
import { ChatLayout } from '../components/chat/ChatLayout';
import { ConversationSidebar } from '../components/chat/ConversationSidebar';
import { ChatMessageItem } from '../components/chat/ChatMessageItem';
import { ChatComposer } from '../components/chat/ChatComposer';
import { ChatEmptyState } from '../components/chat/ChatEmptyState';
import { SourcePanel } from '../components/chat/SourcePanel';
import { realApi, api, ApiError, type RepositoryDetailOut } from '../lib/api';
import { Conversation, ChatMessage, Citation } from '../lib/types';
import { toast } from '../components/ui/sonner';

export function ChatPage() {
  const { id: repoId, conversationId } = useParams<{ id: string; conversationId?: string }>();
  const navigate = useNavigate();

  const [repo, setRepo] = React.useState<RepositoryDetailOut | null>(null);
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

  // Error and rate limit states
  const [errorInfo, setErrorInfo] = React.useState<{ code?: string; message: string; retryAfter?: number } | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = React.useState<number | null>(null);
  const [isLockedPolling, setIsLockedPolling] = React.useState(false);

  // Mobile drawer states
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const [mobileSourceOpen, setMobileSourceOpen] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const isStreamingRef = React.useRef(false);

  const scrollToBottom = React.useCallback((force = false) => {
    if (scrollRef.current) {
      if (force) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      } else {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    }
  }, []);

  // Load repository details and conversations
  const loadRepoAndConvs = React.useCallback(async () => {
    if (!repoId) return;
    try {
      const repoData = await realApi.getRepositoryDetail(repoId);
      setRepo(repoData);

      setLoadingConversations(true);
      const convListRes = await realApi.listConversations(repoId, 1, 50);
      const convItems: Conversation[] = (convListRes.items || []).map((c) => ({
        id: c.id,
        repository_id: repoId,
        title: c.title || 'Untitled conversation',
        created_at: c.created_at,
        updated_at: c.created_at,
        pinned_sha: '',
        message_count: 0,
      }));
      setConversations(convItems);

      if (!activeConvId && convItems.length > 0 && convItems[0]) {
        setActiveConvId(convItems[0].id);
      }
    } catch {
      toast.error('Failed to load repository conversations');
    } finally {
      setLoadingConversations(false);
    }
  }, [repoId, activeConvId]);

  React.useEffect(() => {
    loadRepoAndConvs();
  }, [loadRepoAndConvs]);

  // Synchronize route param with active conversation
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

    let isCancelled = false;
    const fetchMessages = async () => {
      setLoadingMessages(true);
      setErrorInfo(null);
      try {
        const msgListRes = await realApi.listMessages(activeConvId, 1, 100);
        if (isCancelled) return;
        const mappedMessages: ChatMessage[] = (msgListRes.items || []).map((m) => ({
          id: m.id,
          conversation_id: m.conversation_id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          citations: (m.citations || []).map((c) => ({
            path: c.file_path,
            start_line: c.start_line || 0,
            end_line: c.end_line || 0,
            language: c.file_path.split('.').pop() || 'text',
          })),
          created_at: m.created_at,
        }));
        setMessages(mappedMessages);
        setTimeout(() => scrollToBottom(true), 50);
      } catch {
        if (!isCancelled) {
          setErrorInfo({ message: 'Failed to load messages for this conversation.' });
        }
      } finally {
        if (!isCancelled) {
          setLoadingMessages(false);
        }
      }
    };

    fetchMessages();

    return () => {
      isCancelled = true;
    };
  }, [activeConvId, scrollToBottom]);

  // Rate limit countdown effect
  React.useEffect(() => {
    if (rateLimitCountdown === null || rateLimitCountdown <= 0) return;
    const timer = setInterval(() => {
      setRateLimitCountdown((prev) => (prev && prev > 1 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitCountdown]);

  const handleNewChat = async () => {
    if (!repoId || streaming) return;
    try {
      const newConv = await realApi.createConversation(repoId, 'New exploration');
      const convItem: Conversation = {
        id: newConv.id,
        repository_id: repoId,
        title: newConv.title || 'New exploration',
        created_at: newConv.created_at,
        updated_at: newConv.created_at,
        pinned_sha: '',
        message_count: 0,
      };
      setConversations((prev) => [convItem, ...prev]);
      setActiveConvId(convItem.id);
      setMessages([]);
      setErrorInfo(null);
      setStreamedText('');
      setStreamedCitations([]);
      navigate(`/repositories/${repoId}/chat/${convItem.id}`);
      setMobileSidebarOpen(false);
    } catch {
      toast.error('Failed to create new chat');
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await realApi.deleteConversation(id);
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
      toast.success('Conversation deleted');
    } catch {
      toast.error('Failed to delete conversation');
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !repoId || streaming || isStreamingRef.current) return;

    let convId = activeConvId;

    if (!convId) {
      try {
        const newConv = await realApi.createConversation(repoId, text.slice(0, 36) + '...');
        convId = newConv.id;
        const convItem: Conversation = {
          id: convId,
          repository_id: repoId,
          title: newConv.title || text.slice(0, 36) + '...',
          created_at: newConv.created_at,
          updated_at: newConv.created_at,
          pinned_sha: '',
          message_count: 0,
        };
        setConversations((prev) => [convItem, ...prev]);
        setActiveConvId(convId);
        navigate(`/repositories/${repoId}/chat/${convId}`, { replace: true });
      } catch {
        setErrorInfo({ message: 'Failed to initialize conversation thread.' });
        return;
      }
    }

    // Append optimistic user message
    const userMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      conversation_id: convId,
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
    scrollToBottom(true);

    isStreamingRef.current = true;

    try {
      await api.streamMessage(convId, text, {
        onToken: (tok: string) => {
          setStreamedText((prev) => prev + tok);
          scrollToBottom();
        },
        onCitation: (cit: Citation) => {
          setStreamedCitations((prev) => [...prev, cit]);
        },
        onError: (err) => {
          isStreamingRef.current = false;
          setStreaming(false);

          if (err.retry_after) {
            setRateLimitCountdown(err.retry_after);
          }

          setErrorInfo({
            code: err.error_type,
            message: err.message,
            retryAfter: err.retry_after,
          });
        },
        onComplete: (completedMsg: ChatMessage) => {
          isStreamingRef.current = false;
          setMessages((prev) => [...prev, completedMsg]);
          setStreaming(false);
          setStreamedText('');
          setStreamedCitations([]);
          scrollToBottom();
        },
      });
    } catch (err: unknown) {
      isStreamingRef.current = false;
      setStreaming(false);

      if (err instanceof ApiError && err.status === 409) {
        // Handle in-flight lock (409 Conflict): poll GET messages with backoff
        setIsLockedPolling(true);
        setErrorInfo({
          code: '409_LOCKED',
          message: 'Another response is currently in progress for this conversation. Polling for completion...',
        });

        const targetConvId = convId;
        let pollDelay = 3000;
        const maxPollTime = 180000; // 180s lock TTL
        const startTime = Date.now();

        const pollInterval = setInterval(async () => {
          if (Date.now() - startTime > maxPollTime) {
            clearInterval(pollInterval);
            setIsLockedPolling(false);
            setErrorInfo({
              code: 'LOCK_TIMEOUT',
              message: 'Timed out waiting for in-flight response to complete.',
            });
            return;
          }

          try {
            const listRes = await realApi.listMessages(targetConvId, 1, 100);
            const latestMsg = listRes.items?.[listRes.items.length - 1];
            if (latestMsg && latestMsg.role === 'assistant') {
              clearInterval(pollInterval);
              setIsLockedPolling(false);
              setErrorInfo(null);
              // Reload all messages
              const mapped: ChatMessage[] = (listRes.items || []).map((m) => ({
                id: m.id,
                conversation_id: m.conversation_id,
                role: m.role as 'user' | 'assistant',
                content: m.content,
                citations: (m.citations || []).map((c) => ({
                  path: c.file_path,
                  start_line: c.start_line || 0,
                  end_line: c.end_line || 0,
                  language: c.file_path.split('.').pop() || 'text',
                })),
                created_at: m.created_at,
              }));
              setMessages(mapped);
              scrollToBottom();
            }
          } catch {
            // Keep polling
          }
          pollDelay = Math.min(pollDelay * 1.5, 15000);
        }, pollDelay);
      } else if (err instanceof ApiError && err.status === 429) {
        const retryAfter = err.retryAfter || 30;
        setRateLimitCountdown(retryAfter);
        setErrorInfo({
          code: '429_RATE_LIMIT',
          message: `Rate limit reached. Please wait ${retryAfter}s.`,
          retryAfter,
        });
      } else {
        // Network interruption: check if message was partially saved
        setErrorInfo({
          code: 'STREAM_DISCONNECT',
          message: err instanceof Error ? err.message : 'Stream interrupted. Checking for saved message...',
        });
        try {
          const listRes = await realApi.listMessages(convId, 1, 100);
          if (listRes.items && listRes.items.length > messages.length) {
            // Assistant response was saved in DB!
            const mapped: ChatMessage[] = listRes.items.map((m) => ({
              id: m.id,
              conversation_id: m.conversation_id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
              citations: (m.citations || []).map((c) => ({
                path: c.file_path,
                start_line: c.start_line || 0,
                end_line: c.end_line || 0,
                language: c.file_path.split('.').pop() || 'text',
              })),
              created_at: m.created_at,
            }));
            setMessages(mapped);
            setErrorInfo(null);
          }
        } catch {
          // ignore
        }
      }
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
        content: streamedText + '\n\n*(Generation stopped)*',
        citations: streamedCitations,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, partialMsg]);
      setStreamedText('');
      setStreamedCitations([]);
    }
  };

  const handleSelectCitation = (citation: Citation) => {
    setSelectedCitation(citation);
    setMobileSourceOpen(true);
  };

  const handleSelectConv = (id: string) => {
    setActiveConvId(id);
    navigate(`/repositories/${repoId}/chat/${id}`);
    setMobileSidebarOpen(false);
  };

  return (
    <AnimatedPage className="flex flex-col flex-1 h-full min-h-0 overflow-hidden bg-surface-base">
      {/* 5-tab Sticky Header */}
      {repo && <RepositoryHeader repository={repo} onReindex={async () => {}} />}

      {/* Main Resizable Chat Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatLayout
          mobileSidebarOpen={mobileSidebarOpen}
          onMobileSidebarClose={() => setMobileSidebarOpen(false)}
          mobileSourceOpen={mobileSourceOpen}
          onMobileSourceClose={() => setMobileSourceOpen(false)}
          sidebar={
            <ConversationSidebar
              conversations={conversations}
              activeConvId={activeConvId}
              onSelectConv={handleSelectConv}
              onNewChat={handleNewChat}
              onDeleteConv={handleDeleteConversation}
              loading={loadingConversations}
            />
          }
          sourcePanel={
            selectedCitation && repoId ? (
              <SourcePanel
                citation={selectedCitation}
                repoId={repoId}
                onClose={() => {
                  setSelectedCitation(null);
                  setMobileSourceOpen(false);
                }}
              />
            ) : null
          }
          main={
            <div className="flex flex-col h-full bg-surface-base relative">
              {/* Mobile subheader to toggle chat sidebar */}
              <div className="md:hidden flex items-center justify-between p-2.5 border-b border-white/10 bg-surface-raised">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileSidebarOpen(true)}
                  className="gap-1.5 text-xs text-text-secondary hover:text-text-primary"
                >
                  <MaterialIcon name="menu" size={16} />
                  <span>Chats ({conversations.length})</span>
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleNewChat}
                  className="h-7 text-xs font-medium gap-1"
                >
                  <MaterialIcon name="add" size={14} />
                  <span>New</span>
                </Button>
              </div>

              {/* Status/Rate Limit/Lock Callout */}
              {rateLimitCountdown !== null && (
                <div className="p-2.5 px-4 bg-status-amber/10 border-b border-status-amber/20 flex items-center justify-between text-xs text-status-amber">
                  <div className="flex items-center gap-2">
                    <MaterialIcon name="timer" size={16} />
                    <span>Rate limit reached. Retrying in {rateLimitCountdown}s...</span>
                  </div>
                </div>
              )}

              {isLockedPolling && (
                <div className="p-2.5 px-4 bg-accent/10 border-b border-accent/20 flex items-center gap-2 text-xs text-accent">
                  <MaterialIcon name="sync" size={16} spin />
                  <span>Another response is currently in progress. Polling for completion...</span>
                </div>
              )}

              {errorInfo && !isLockedPolling && rateLimitCountdown === null && (
                <div className="p-3 px-4 bg-status-red/10 border-b border-status-red/20 flex items-center justify-between text-xs text-status-red">
                  <div className="flex items-center gap-2">
                    <MaterialIcon name="error" size={16} />
                    <span>{errorInfo.message}</span>
                  </div>
                  <span className="text-[11px] text-text-tertiary">
                    {/* Blocker: block retry without duplicate user messages */}
                    Retry requires server-side regeneration. Please edit or submit your prompt again.
                  </span>
                </div>
              )}

              {/* Messages Thread */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4 space-y-4 no-scrollbar"
              >
                {loadingMessages ? (
                  <div className="p-8 text-center text-xs text-text-tertiary">
                    Loading conversation messages...
                  </div>
                ) : messages.length === 0 && !streaming ? (
                  <ChatEmptyState repositoryName={repo?.name} />
                ) : (
                  <>
                    {messages.map((msg) => (
                      <ChatMessageItem
                        key={msg.id}
                        message={msg}
                        repoId={repoId || ''}
                        onSelectCitation={handleSelectCitation}
                        selectedCitation={selectedCitation}
                      />
                    ))}

                    {/* Active streaming response */}
                    {streaming && (
                      <div className="flex gap-3 max-w-3xl mx-auto w-full my-5 px-4 select-text">
                        <div className="h-6 w-6 rounded bg-surface-overlay border border-white/10 flex items-center justify-center text-accent shrink-0 mt-0.5">
                          <MaterialIcon name="smart_toy" size={14} />
                        </div>
                        <div className="flex-1 min-w-0 space-y-3">
                          <div className="text-xs leading-relaxed text-text-primary whitespace-pre-wrap font-sans">
                            {streamedText || (
                              <span className="inline-flex items-center gap-1.5 text-text-tertiary">
                                <MaterialIcon name="sync" size={13} spin />
                                Synthesizing answer grounded in repository citations...
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Chat Composer */}
              <ChatComposer
                inputText={inputText}
                setInputText={setInputText}
                onSendMessage={handleSendMessage}
                onStopStreaming={handleStopStreaming}
                streaming={streaming}
                disabled={isLockedPolling || rateLimitCountdown !== null}
              />
            </div>
          }
        />
      </div>
    </AnimatedPage>
  );
}
export default ChatPage;
