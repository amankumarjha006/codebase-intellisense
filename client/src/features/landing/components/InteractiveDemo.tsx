import * as React from 'react';
import { motion, AnimatePresence, useInView, useReducedMotion } from 'motion/react';
import demoEntries from '../data/demo.json';
import proofData from '../data/proof.json';

interface Citation {
  citationId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  snippetHtml: string;
}

interface DemoItem {
  id: string;
  title: string;
  verified: boolean;
  query: string;
  answer: string;
  citations: Citation[];
  metadata: {
    repo: string;
    commit: string;
    capturedAt: string;
    model: string;
  };
}

const items: DemoItem[] = demoEntries as DemoItem[];

export const InteractiveDemo: React.FC = () => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.25 });
  const shouldReduceMotion = useReducedMotion();

  const [activeIndex, setActiveIndex] = React.useState<number>(0);
  const [typedQuery, setTypedQuery] = React.useState<string>('');
  const [streamedText, setStreamedText] = React.useState<string>('');
  const [isTyping, setIsTyping] = React.useState<boolean>(false);
  const [isStreaming, setIsStreaming] = React.useState<boolean>(false);
  const [isPaused, setIsPaused] = React.useState<boolean>(false);
  const [selectedCitation, setSelectedCitation] = React.useState<Citation | null>(null);

  const activeItem = items[activeIndex] || items[0];

  // Reset or run stream when active item changes or container comes in view
  const runSequence = React.useCallback(
    (item: DemoItem) => {
      if (shouldReduceMotion) {
        setTypedQuery(item.query);
        setStreamedText(item.answer);
        setIsTyping(false);
        setIsStreaming(false);
        setSelectedCitation(item.citations[0] || null);
        return;
      }

      setTypedQuery('');
      setStreamedText('');
      setIsTyping(true);
      setIsStreaming(false);
      setSelectedCitation(null);

      // 1. Type query
      let queryIdx = 0;
      const queryInterval = setInterval(() => {
        if (isPaused) return;
        queryIdx += 2;
        if (queryIdx >= item.query.length) {
          setTypedQuery(item.query);
          clearInterval(queryInterval);
          setIsTyping(false);

          // 2. Stream answer
          setTimeout(() => {
            setIsStreaming(true);
            const tokens = item.answer.split(' ');
            let tokenIdx = 0;
            const streamInterval = setInterval(() => {
              if (isPaused) return;
              tokenIdx += 2;
              if (tokenIdx >= tokens.length) {
                setStreamedText(item.answer);
                clearInterval(streamInterval);
                setIsStreaming(false);
                // Automatically activate primary citation on completion
                if (item.citations.length > 0) {
                  setSelectedCitation(item.citations[0]);
                }
              } else {
                setStreamedText(tokens.slice(0, tokenIdx).join(' '));
              }
            }, 30);
          }, 250);
        } else {
          setTypedQuery(item.query.slice(0, queryIdx));
        }
      }, 25);
    },
    [shouldReduceMotion, isPaused]
  );

  React.useEffect(() => {
    if (isInView) {
      runSequence(activeItem);
    }
  }, [isInView, activeIndex, runSequence, activeItem]);

  return (
    <section
      id="demo"
      aria-labelledby="demo-heading"
      className="py-24 border-t border-[var(--color-landing-hairline)]"
    >
      <div className="max-w-4xl mx-auto mb-10 text-center">
        <p className="text-xs font-[family-name:var(--font-code)] text-[var(--color-landing-ink-tertiary)] uppercase tracking-wider">
          02 // Interactive Verification
        </p>
        <h2
          id="demo-heading"
          className="text-3xl sm:text-5xl font-normal tracking-tight mt-2 text-[var(--color-landing-ink)]"
        >
          Ask questions. Open the line.
        </h2>
        <p className="mt-3 text-sm sm:text-base text-[var(--color-landing-ink-secondary)]">
          Real questions, streaming answer tokens, and verified source snippets recorded directly from{' '}
          <a
            href={proofData.repositoryUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-[var(--color-landing-ink)] underline hover:text-[var(--color-landing-accent)]"
          >
            fastapi/fastapi
          </a>{' '}
          (Apache 2.0 License).
        </p>
      </div>

      {/* Cockpit Window Container */}
      <div
        ref={containerRef}
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] shadow-2xl overflow-hidden text-[var(--panel-text)] transition-all"
      >
        {/* Cockpit Title Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--panel-border)] bg-[var(--panel-surface)]">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <span className="text-xs text-[var(--panel-text-secondary)] font-[family-name:var(--font-code)] ml-2 hidden sm:inline-block">
              fastapi/fastapi @ {proofData.shortCommit}
            </span>
          </div>

          {/* Question Selector Chips */}
          <div className="flex items-center space-x-2">
            {items.map((item, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveIndex(idx);
                  }}
                  className={`text-xs px-3 py-1 rounded-md font-medium transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-landing-accent)] ${
                    isSelected
                      ? 'bg-[var(--panel-raised)] text-[var(--panel-text)] border border-[var(--color-landing-accent)] shadow-xs'
                      : 'text-[var(--panel-text-secondary)] hover:text-[var(--panel-text)] hover:bg-[var(--panel-raised)]/60'
                  }`}
                >
                  {item.title}
                </button>
              );
            })}
          </div>

          {/* Playback Controls */}
          <div className="flex items-center space-x-2 text-xs">
            <button
              onClick={() => setIsPaused((prev) => !prev)}
              aria-label={isPaused ? 'Resume streaming demo' : 'Pause streaming demo'}
              className="px-2 py-1 rounded text-[var(--panel-text-secondary)] hover:text-[var(--panel-text)] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-landing-accent)]"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={() => runSequence(activeItem)}
              aria-label="Replay current question demo"
              className="px-2 py-1 rounded text-[var(--panel-text-secondary)] hover:text-[var(--panel-text)] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-landing-accent)]"
            >
              Replay
            </button>
          </div>
        </div>

        {/* Cockpit Main Body (Grid of Query + Answer & Synchronized Source Viewer) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[520px]">
          {/* Left Column: Query Bar + Answer Stream */}
          <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[var(--panel-border)] bg-[var(--panel-bg)]">
            <div>
              {/* Query Bar */}
              <div className="p-3.5 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-surface)] flex items-center space-x-3 mb-6">
                <span className="w-2 h-2 rounded-full bg-[var(--color-landing-accent)]" />
                <span className="text-sm font-[family-name:var(--font-code)] text-[var(--panel-text)] truncate">
                  {typedQuery || <span className="opacity-40">Ask repository question...</span>}
                </span>
                {isTyping && <span className="w-1.5 h-4 bg-[var(--color-landing-accent)] animate-pulse" />}
              </div>

              {/* Streaming Answer Container (aria-live="off" to prevent per-token chatter) */}
              <div aria-live="off" className="space-y-4 text-sm sm:text-base leading-relaxed text-[var(--panel-text)]">
                <p className="whitespace-pre-line">
                  {streamedText}
                  {isStreaming && (
                    <span className="inline-block w-1.5 h-4 ml-1 bg-[var(--color-landing-accent)] animate-pulse align-middle" />
                  )}
                </p>
              </div>

              {/* Static hidden article for screen-readers providing complete accessibility */}
              <article className="sr-only">
                <h3>{activeItem.query}</h3>
                <p>{activeItem.answer}</p>
                <ul>
                  {activeItem.citations.map((c) => (
                    <li key={c.citationId}>
                      [{c.citationId}] {c.filePath} lines {c.startLine} to {c.endLine}
                    </li>
                  ))}
                </ul>
              </article>
            </div>

            {/* Citation Badges Row */}
            <div className="mt-8 pt-4 border-t border-[var(--panel-border)]">
              <p className="text-xs font-[family-name:var(--font-code)] text-[var(--panel-text-secondary)] mb-2.5">
                Verified Line Citations:
              </p>
              <div className="flex flex-wrap gap-2">
                {activeItem.citations.map((citation) => {
                  const isChipActive = selectedCitation?.citationId === citation.citationId;
                  return (
                    <motion.button
                      key={citation.citationId}
                      initial={shouldReduceMotion ? false : { scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      onClick={() => setSelectedCitation(citation)}
                      className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-[family-name:var(--font-code)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-landing-accent)] ${
                        isChipActive
                          ? 'bg-[var(--color-landing-accent)] text-[#0B0D10] font-semibold shadow-[0_0_12px_rgba(138,180,248,0.4)]'
                          : 'border border-[var(--panel-border)] bg-[var(--panel-surface)] text-[var(--panel-text-secondary)] hover:text-[var(--panel-text)] hover:border-[var(--color-landing-accent)]/50'
                      }`}
                    >
                      <span>[{citation.citationId}]</span>
                      <span className="truncate max-w-[200px]">{citation.filePath}</span>
                      <span className="opacity-70">:{citation.startLine}-{citation.endLine}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Synchronized Pre-Tokenized Source Viewer */}
          <div className="lg:col-span-6 bg-[#0B0D10] flex flex-col justify-between overflow-hidden">
            {/* Source Panel Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--panel-border)] bg-[var(--panel-surface)]/60 text-xs text-[var(--panel-text-secondary)] font-[family-name:var(--font-code)]">
              <div className="flex items-center space-x-2 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-landing-accent)]" />
                <span className="text-[var(--panel-text)] truncate">
                  {selectedCitation?.filePath || 'Source Inspection'}
                </span>
              </div>
              {selectedCitation && (
                <span className="text-[var(--color-landing-accent)] font-semibold shrink-0">
                  Lines {selectedCitation.startLine}–{selectedCitation.endLine}
                </span>
              )}
            </div>

            {/* Source Code Snippet View (Pre-tokenized Shiki HTML with strict white-space: pre) */}
            <div className="p-4 sm:p-6 overflow-x-auto flex-1 font-[family-name:var(--font-code)] text-xs leading-relaxed max-h-[460px]">
              <AnimatePresence mode="wait">
                {selectedCitation ? (
                  <motion.div
                    key={selectedCitation.citationId}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    dangerouslySetInnerHTML={{ __html: selectedCitation.snippetHtml }}
                  />
                ) : (
                  <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center text-[var(--panel-text-secondary)] p-8">
                    <p className="text-sm font-medium">Select a citation badge to inspect verified lines</p>
                    <p className="text-xs opacity-60 mt-1">Citations open exact source lines with white-space fidelity</p>
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Source Panel Footer Attribution */}
            <div className="px-5 py-2.5 border-t border-[var(--panel-border)] bg-[var(--panel-surface)]/40 flex items-center justify-between text-[11px] font-[family-name:var(--font-code)] text-[var(--panel-text-secondary)]">
              <span>AST Symbol Resolution: Tree-sitter</span>
              <span>Model: {activeItem.metadata.model}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

