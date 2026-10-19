import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  MessageSquare,
  Plus,
  Send,
  FileCode,
  AlertCircle,
  ArrowDown,
  RotateCcw,
  StopCircle,
  Loader2,
  GitBranch,
  Bot,
  Terminal,
  Code2,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  Repository,
  Conversation,
  ChatMessage,
  Citation,
} from '../lib/types';
import { formatRelativeTime } from '../lib/utils';
import { RepositoryHeader } from '../components/repository/RepositoryHeader';
import { RepositoryNavDock } from '../components/repository/RepositoryNavDock';
import { SourcePanel } from '../components/chat/SourcePanel';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/input';
import { AnimatedPage } from '../components/ui/AnimatedPage';
import { LiveRegion } from '../components/ui/A11y';

interface RepoSuggestion {
  question: string;
  file_hint: string;
}

function buildRepoSuggestions(repoName: string, files: string[] = []): RepoSuggestion[] {
  if (!files || files.length === 0) {
    return [
      {
        question: `What is the architecture and folder structure of ${repoName}?`,
        file_hint: `${repoName} structure`,
      },
      {
        question: `What are the core features and capabilities in ${repoName}?`,
        file_hint: `${repoName} features`,
      },
      {
        question: `How does data and logic flow across this codebase?`,
        file_hint: `Data flow`,
      },
      {
        question: `What are the prerequisites and setup steps to run ${repoName}?`,
        file_hint: `Setup & configuration`,
      },
    ];
  }

  const suggestions: RepoSuggestion[] = [];

  // 1. Entry point / Application initialization
  const entryFile = files.find((p) =>
    /^(src\/)?(App|main|index)\.(jsx?|tsx?|vue|py|go|rs|js|ts)$/i.test(p) ||
    /^(main\.py|app\.py|index\.html|server\.js|app\.js)$/i.test(p)
  );
  if (entryFile) {
    const fileName = entryFile.split('/').pop()!;
    suggestions.push({
      question: `How does the application initialize and render in ${fileName}?`,
      file_hint: entryFile,
    });
  } else {
    suggestions.push({
      question: `What is the entry point and primary architecture of ${repoName}?`,
      file_hint: files[0] || `${repoName} entry`,
    });
  }

  // 2. Pages / Routes / Views / Components
  const routeOrComponent = files.find((p) =>
    /(pages|routes|views|screens|components)\/.*\.(jsx?|tsx?|vue|py|html)$/i.test(p)
  );
  if (routeOrComponent) {
    const targetName = routeOrComponent.split('/').pop()!;
    suggestions.push({
      question: `What are the main pages and navigation flows around ${targetName}?`,
      file_hint: routeOrComponent,
    });
  } else {
    suggestions.push({
      question: `What are the core functional modules in ${repoName}?`,
      file_hint: `${repoName} modules`,
    });
  }

  // 3. Data / Models / State / API
  const dataOrApi = files.find((p) =>
    /(data|api|services|models|store|state|utils)\/.*\.(jsx?|tsx?|py|js|ts|json)$/i.test(p) &&
    !p.includes('package')
  );
  if (dataOrApi) {
    const dataName = dataOrApi.split('/').pop()!;
    suggestions.push({
      question: `How is data structured and managed in ${dataName}?`,
      file_hint: dataOrApi,
    });
  } else {
    suggestions.push({
      question: `How is state and business logic handled across this project?`,
      file_hint: `Logic & State`,
    });
  }

  // 4. Dependencies / Configuration / Build
  const configFile = files.find((p) =>
    /^(package\.json|vite\.config\.[jt]s|requirements\.txt|pyproject\.toml|Cargo\.toml|go\.mod|webpack\.config\.js|tailwind\.config\.[jt]s)$/i.test(p)
  );
  if (configFile) {
    suggestions.push({
      question: `What packages, scripts, and build tools are defined in ${configFile}?`,
      file_hint: configFile,
    });
  } else {
    suggestions.push({
      question: `How is this repository configured and built?`,
      file_hint: `Configuration`,
    });
  }

  return suggestions;
}

export function ChatPage() {
  const { id: repoId, conversationId } = useParams<{ id: string; conversationId?: string }>();
  const navigate = useNavigate();

  const [repository, setRepository] = React.useState<Repository | null>(null);
  const [repoFiles, setRepoFiles] = React.useState<string[]>([]);
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
  const [a11yStatus, setA11yStatus] = React.useState('');

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const isStreamingRef = React.useRef(false);

  // Load repo, files, and conversations
  const loadRepoAndConvs = React.useCallback(async () => {
    if (!repoId) return;
    try {
      const repo = await api.getRepository(repoId);
      setRepository(repo);
      const convList = await api.getConversations(repoId);
      setConversations(convList);

      setActiveConvId((curr) => curr || (convList.length > 0 && convList[0] ? convList[0].id : null));

      // Fetch repository files to generate repo-specific suggestions
      try {
        const fileListRes = await api.getRepositoryFiles(repoId, 100, 0);
        if (fileListRes?.files) {
          setRepoFiles(fileListRes.files.map((f: { path: string }) => f.path));
        }
      } catch {
        // Fallback gracefully if repository files are pending
      }
    } catch {
      // Ignore
    }
  }, [repoId]);

  React.useEffect(() => {
    loadRepoAndConvs();
  }, [loadRepoAndConvs]);

  // Load messages when active conversation changes
  React.useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    if (isStreamingRef.current) return;

    api.getMessages(activeConvId).then((msgs: ChatMessage[]) => {
      if (!isStreamingRef.current) {
        setMessages(msgs);
        scrollToBottom();
      }
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
    setA11yStatus('Synthesizing answer from repository AST nodes...');
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
    } finally {
      isStreamingRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!repository) {
    return (
      <div
        role="status"
        aria-label="Loading repository"
        className="p-8 text-center text-xs text-[var(--color-muted)]"
      >
        Loading repository...
      </div>
    );
  }

  const isIndexing = repository.latest_job_status === 'INDEXING';
  const showNewerVersionBanner =
    !newerVersionDismissed && repository.latest_job_status === 'FAILED';

  return (
    <AnimatedPage className="flex flex-col h-full bg-[var(--color-page)]">
      <LiveRegion message={a11yStatus} />
      <RepositoryHeader repository={repository} />

      {/* Newer version banner */}
      {showNewerVersionBanner && (
        <div
          role="status"
          aria-label="Newer version indexed notice"
          className="px-6 py-2.5 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-secondary)]"
        >
          <div className="flex items-center gap-2">
            <GitBranch size={14} className="text-[var(--color-accent)] shrink-0" aria-hidden="true" />
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
        <div
          role="status"
          aria-label="Repository is currently indexing"
          className="px-6 py-2 bg-[var(--color-warning-tint)] border-b border-[rgba(251,191,36,0.3)] text-xs text-[var(--color-warning)] flex items-center gap-2"
        >
          <Loader2 size={13} className="animate-spin" aria-hidden="true" />
          <span>
            Repository is currently indexing. Q&A answers will be grounded as soon as AST embeddings complete.
          </span>
        </div>
      )}

      {/* Main Chat Split: Sidebar + Messages + Source Panel */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left: Conversation History */}
        <aside
          aria-label="Chat history sidebar"
          className="w-64 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col shrink-0 hidden md:flex"
        >
          <div className="p-3 border-b border-[var(--color-border)]">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleNewChat}
              className="w-full justify-start gap-2"
              aria-label="Start new conversation"
            >
              <Plus size={14} aria-hidden="true" />
              <span>New question</span>
            </Button>
          </div>

          <div
            role="listbox"
            aria-label="Previous conversations"
            className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar"
          >
            {conversations.map((conv) => {
              const active = conv.id === activeConvId;
              return (
                <button
                  key={conv.id}
                  role="option"
                  aria-selected={active}
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
                  <MessageSquare size={14} className="mt-0.5 shrink-0 text-[var(--color-muted)]" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{conv.title}</div>
                    <div className="text-[10px] text-[var(--color-muted)] font-mono mt-0.5">
                      {formatRelativeTime(conv.updated_at)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Center: Messages Thread & Composer */}
        <main
          id="main-content"
          aria-label="Conversation message thread"
          className="flex-1 flex flex-col overflow-hidden relative bg-[var(--color-page)]"
        >
          {/* Messages viewport */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            role="log"
            aria-label="Chat messages"
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6"
          >
            {/* Empty State / Suggested Questions if no messages */}
            {messages.length === 0 && !streaming && (
              <section
                aria-label="Repository inquiry suggestions"
                className="max-w-2xl mx-auto py-12 text-center space-y-6"
              >
                <div
                  className="h-12 w-12 rounded-xl bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)] mx-auto"
                  aria-hidden="true"
                >
                  <Terminal size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text)]">
                    Ask anything about {repository.name}
                  </h2>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-md mx-auto leading-relaxed">
                    Explore the codebase, understand component architectures, and verify implementation details with exact AST line coordinates.
                  </p>
                </div>

                {/* Suggested Questions Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
                  {buildRepoSuggestions(repository.name, repoFiles).map((sq, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(sq.question)}
                      className="p-3.5 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)] hover:bg-[var(--color-raised)]/60 transition text-xs space-y-1.5 group text-left"
                    >
                      <div className="font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                        {sq.question}
                      </div>
                      {sq.file_hint && (
                        <div className="text-[11px] font-mono text-[var(--color-muted)] truncate flex items-center gap-1">
                          <Code2 size={11} className="shrink-0" aria-hidden="true" />
                          <span>{sq.file_hint}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </section>
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
                  <div
                    className="h-7 w-7 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)] shrink-0 mt-0.5"
                    aria-label="AI response"
                  >
                    <Bot size={15} aria-hidden="true" />
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
                        <div
                          aria-label="Source code citations"
                          className="pt-2 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)]/60"
                        >
                          <span className="text-[11px] text-[var(--color-muted)] font-medium">
                            Citations:
                          </span>
                          {msg.citations.map((c, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedCitation(c)}
                              aria-label={`View citation in ${c.path.split('/').pop()} lines ${c.start_line} to ${c.end_line}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border border-[var(--color-accent-border)] bg-[var(--color-accent-tint)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition cursor-pointer"
                            >
                              <FileCode size={12} aria-hidden="true" />
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
              <div className="flex gap-3 max-w-3xl mx-auto justify-start" aria-live="polite">
                <div
                  className="h-7 w-7 rounded-lg bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)] shrink-0 mt-0.5"
                  aria-label="Assistant streaming"
                >
                  <Bot size={15} className="animate-pulse" aria-hidden="true" />
                </div>
                <div className="rounded-[var(--radius-panel)] p-4 text-xs sm:text-sm leading-relaxed max-w-[85%] space-y-3">
                  <div className="prose prose-invert prose-xs max-w-none">
                    <Markdown remarkPlugins={[remarkGfm]}>{streamedText}</Markdown>
                    <span className="inline-block w-1.5 h-3.5 bg-[var(--color-accent)] animate-pulse ml-0.5 align-middle" />
                  </div>

                  {streamedCitations.length > 0 && (
                    <div
                      aria-label="Discovered citations"
                      className="pt-2 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)]/60"
                    >
                      <span className="text-[11px] text-[var(--color-muted)] font-medium">
                        Citations:
                      </span>
                      {streamedCitations.map((c, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedCitation(c)}
                          aria-label={`View citation in ${c.path.split('/').pop()} lines ${c.start_line} to ${c.end_line}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border border-[var(--color-accent-border)] bg-[var(--color-accent-tint)] text-[var(--color-accent)]"
                        >
                          <FileCode size={12} aria-hidden="true" />
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
              <div
                role="alert"
                aria-live="assertive"
                className="max-w-2xl mx-auto p-4 rounded-[var(--radius-panel)] border border-[var(--color-error-border)] bg-[var(--color-error-tint)] text-xs text-[var(--color-error)] space-y-2"
              >
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle size={15} aria-hidden="true" />
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
                    <RotateCcw size={12} aria-hidden="true" />
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
              aria-label="Jump to latest message"
              className="absolute bottom-20 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[var(--color-raised)] border border-[var(--color-border-strong)] text-xs text-[var(--color-text)] shadow-lg flex items-center gap-1.5 hover:bg-[var(--color-surface)] transition"
            >
              <ArrowDown size={13} aria-hidden="true" />
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
                aria-label="Ask about this repository"
                placeholder="Ask about functions, architecture, or flow... (Enter to send, Shift+Enter for newline)"
                className="min-h-[72px] max-h-36 border-0 bg-transparent resize-none p-3 text-xs sm:text-sm focus-visible:ring-0"
              />
              <div className="flex items-center justify-between p-2 pt-0 text-[11px] text-[var(--color-muted)]">
                <span className="hidden sm:inline font-mono text-[10px]">
                  AST citation verification active
                </span>
                <div className="flex items-center gap-2">
                  {streaming ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setStreaming(false)}
                      className="h-7 text-xs"
                      aria-label="Stop generation"
                    >
                      <StopCircle size={13} aria-hidden="true" />
                      <span>Stop</span>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleSendMessage()}
                      disabled={!inputText.trim()}
                      className="h-7 px-3 text-xs"
                      aria-label="Send message"
                    >
                      <span>Send</span>
                      <Send size={12} aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Right: Source Panel */}
        {selectedCitation && (
          <SourcePanel
            citation={selectedCitation}
            repoId={repository.id}
            onClose={() => setSelectedCitation(null)}
          />
        )}

        {/* Floating Vertical Navigation Dock (Desktop lg+) */}
        <aside
          aria-label="Repository navigation dock"
          className="hidden lg:block p-3 shrink-0 z-10 self-start"
        >
          <RepositoryNavDock repoId={repository.id} orientation="vertical" />
        </aside>
      </div>
    </AnimatedPage>
  );
}
