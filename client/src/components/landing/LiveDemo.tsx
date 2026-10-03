"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { RotateCcw, Play, FileCode2, Send } from "lucide-react";

const codeSnippet = `export const api = {
  getCurrentUser: () => 
    fetchWrapper<CurrentUser>('/auth/me'),
  logout: () => 
    fetchWrapper<void>('/auth/logout', { 
      method: 'POST' 
    }),
  listRepositories: (page = 1, limit = 50, search = '') => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (search) params.append('search', search);
    return fetchWrapper<RepositoryListOut>(
      \`/repositories?\${params.toString()}\`
    );
  },
};`;

const question = "How do we fetch repositories?";
const answerParts = [
  { text: "We fetch repositories using the ", delay: 0 },
  { text: "api.ts:8-17", isCitation: true, range: [7, 16], delay: 10 },
  { text: " listRepositories method. It accepts pagination and an optional ", delay: 15 },
  { text: "api.ts:13", isCitation: true, range: [12, 12], delay: 35 },
  { text: " search query which it appends to the URL.", delay: 50 }
];

export function LiveDemo() {
  const prefersReducedMotion = useReducedMotion();
  const [isPlaying, setIsPlaying] = useState(!prefersReducedMotion);
  const [isHovered, setIsHovered] = useState(false);
  const [timeMs, setTimeMs] = useState(prefersReducedMotion ? 14000 : 0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const [tokens, setTokens] = useState<any[][]>([]);

  useEffect(() => {
    let mounted = true;
    import('shiki').then(({ createHighlighter }) => {
      createHighlighter({
        themes: ['nord'],
        langs: ['typescript']
      }).then(highlighter => {
        if (!mounted) return;
        const res = highlighter.codeToTokensBase(codeSnippet, { lang: 'typescript', theme: 'nord' });
        setTokens(res);
      });
    }).catch(console.error);
    return () => { mounted = false; };
  }, []);

  const loopDuration = 14000; // 14 seconds
  const typedQuestionLength = Math.min(question.length, Math.floor(timeMs / 50));
  
  const answerStartTime = 2000;
  const currentAnswerParts = prefersReducedMotion 
    ? answerParts 
    : answerParts.filter(part => timeMs >= answerStartTime + part.delay * 50);

  // Find the active citation range
  const activeCitation = currentAnswerParts
    .filter(p => p.isCitation)
    .pop();
  
  const activeRange = activeCitation?.range ?? [-1, -1];
  const isLineActive = (i: number) => i >= activeRange[0] && i <= activeRange[1];

  useEffect(() => {
    if (!isPlaying || isHovered || prefersReducedMotion) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = null;
      return;
    }

    const update = (time: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = time;
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      setTimeMs(prev => {
        const next = prev + delta;
        // Hold final frame for 3s (14s + 3s = 17s total loop)
        if (next >= loopDuration + 3000) return 0;
        return next;
      });
      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, isHovered, prefersReducedMotion]);

  const handleReplay = () => {
    setTimeMs(0);
    if (!isPlaying) setIsPlaying(true);
  };

  return (
    <div 
      className="relative rounded-xl border border-border bg-surface shadow-2xl overflow-hidden flex flex-col sm:flex-row h-[450px] outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-text transition-colors duration-150 hover:border-border/80"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      tabIndex={0}
    >
      {/* Left Pane: Chat */}
      <div className="flex-[0.9] border-b sm:border-b-0 sm:border-r border-border bg-surface flex flex-col">
        <div className="h-10 border-b border-border flex items-center px-4 bg-background/50">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-border" />
            <div className="w-2.5 h-2.5 rounded-full bg-border" />
            <div className="w-2.5 h-2.5 rounded-full bg-border" />
          </div>
        </div>
        
        <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
          {/* User Message */}
          <div className="bg-raised p-3 rounded-lg text-sm text-text border border-border self-end max-w-[85%]">
            {question.slice(0, typedQuestionLength)}
            {!prefersReducedMotion && timeMs < question.length * 50 && (
              <span className="inline-block w-1 h-3 ml-0.5 bg-accent animate-pulse" />
            )}
          </div>

          {/* AI Response */}
          {timeMs >= answerStartTime && (
            <div className="bg-background p-3 rounded-lg text-sm text-text border border-border self-start max-w-[95%] shadow-sm">
              {currentAnswerParts.map((part, i) => {
                if (!part.isCitation) {
                  return <span key={i}>{part.text}</span>;
                }
                return (
                  <motion.span 
                    key={i} 
                    initial={{ scale: 0.96, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.18 }}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-accent-soft text-accent font-mono text-xs border border-accent-border shadow-none"
                  >
                    <FileCode2 className="w-3 h-3" />
                    {part.text}
                  </motion.span>
                );
              })}
              {!prefersReducedMotion && timeMs < loopDuration - 2000 && (
                <span className="inline-block w-1.5 h-1.5 ml-1 rounded-full bg-accent animate-pulse" />
              )}
            </div>
          )}
        </div>
        
        {/* Disabled Composer */}
        <div className="p-3 border-t border-border bg-background/30">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-surface text-muted/50 text-xs cursor-not-allowed">
            <span className="flex-1">Ask about this repo...</span>
            <Send className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Right Pane: Code */}
      <div className="flex-[1.1] bg-[#0A0A0A] flex flex-col font-mono text-xs overflow-hidden">
        <div className="h-10 border-b border-white/5 flex items-center px-4 text-muted gap-2 bg-[#0A0A0A]">
          <FileCode2 className="w-3.5 h-3.5" />
          api.ts
          <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] ml-auto">Example</span>
        </div>
        
        <div 
          className="flex-1 p-4 overflow-y-auto overflow-x-hidden relative"
          style={{ maskImage: "linear-gradient(to right, black 85%, transparent 100%)", WebkitMaskImage: "linear-gradient(to right, black 85%, transparent 100%)", colorScheme: "dark" }}
        >
          <pre className="relative z-10 w-full min-w-max pb-8">
            {tokens.length > 0 ? tokens.map((line, i) => {
              const active = isLineActive(i);
              return (
                <div 
                  key={i} 
                  className="relative px-2 py-[1px] -mx-2 transition-colors duration-300 flex items-center group/line"
                >
                  {/* Highlight Background & Spring Bar */}
                  {active && (
                    <>
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-accent/10"
                      />
                      <motion.div 
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ type: "spring", damping: 20, stiffness: 100 }}
                        className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent origin-top"
                      />
                    </>
                  )}
                  {!active && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-transparent" />}

                  <span className="opacity-30 mr-4 select-none w-4 text-right shrink-0">{i + 1}</span>
                  <span className="relative z-10 whitespace-pre">
                    {line.map((token, j) => {
                      // Apply muted tones if not active, otherwise use original but dimmer
                      const color = active ? token.color : token.color?.replace(/F/g, 'C');
                      return (
                        <span key={j} style={{ color: active ? 'var(--accent)' : color, filter: active ? 'none' : 'saturate(0)' }}>
                          {token.content}
                        </span>
                      );
                    })}
                    {line.length === 0 && ' '}
                  </span>
                </div>
              );
            }) : codeSnippet.split('\\n').map((line, i) => (
              <div key={i} className="px-2 py-[1px] -mx-2 opacity-50 flex items-center">
                <span className="opacity-30 mr-4 select-none w-4 text-right shrink-0">{i + 1}</span>
                {line}
              </div>
            ))}
          </pre>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex gap-2 z-20">
        {prefersReducedMotion && !isPlaying && (
           <button 
             onClick={() => setIsPlaying(true)} 
             className="p-2 rounded-full bg-[#1A1A1A] border border-white/10 text-white hover:bg-[#2A2A2A] transition-colors shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] focus-visible:ring-text"
             aria-label="Play animation"
           >
             <Play className="w-4 h-4" />
           </button>
        )}
        <button 
          onClick={handleReplay} 
          className="p-2 rounded-full bg-[#1A1A1A] border border-white/10 text-white hover:bg-[#2A2A2A] transition-colors shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] focus-visible:ring-text"
          aria-label="Replay animation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
