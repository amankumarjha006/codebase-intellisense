'use client';

import { useState, useEffect, FormEvent, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { X, CheckCircle2, ChevronRight, Copy, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { api, RepositoryOut, ApiError } from '@/lib/api';
import { mapErrorToCopy } from '@/lib/errors';
import { getFailureMessage, DEFAULT_FAILURE_MESSAGE } from '@/lib/status';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ConnectDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (repo: RepositoryOut) => void;
  initialRepository?: RepositoryOut | null;
  onAnalyzeStart?: () => void;
}

const STAGES = ['QUEUED', 'FETCHING', 'INDEXING', 'ANALYZING', 'READY'] as const;

/** Maximum consecutive poll errors before giving up. */
const MAX_POLL_ERRORS = 10;
/** Maximum continuous error duration before giving up (5 minutes). */
const MAX_CONTINUOUS_ERROR_DURATION_MS = 5 * 60 * 1000;

/** Small copyable "Reference: <id>" block for error states. */
function RequestIdRef({ id }: { id?: string }) {
  if (!id) return null;
  return (
    <span className="text-xs opacity-80 font-mono flex items-center gap-1 mt-1">
      Reference: {id}
      <button type="button" onClick={() => navigator.clipboard.writeText(id)} className="hover:text-foreground" aria-label="Copy reference ID">
        <Copy size={12} />
      </button>
    </span>
  );
}

export function ConnectDrawer({ open, onOpenChange, onSuccess, initialRepository, onAnalyzeStart }: ConnectDrawerProps) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  // Step 1: Form State
  const [repoInput, setRepoInput] = useState('');
  const [normalizedRepo, setNormalizedRepo] = useState<string | null>(null);
  const [branchInput, setBranchInput] = useState('');
  const [showBranch, setShowBranch] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<{ message: string; reqId?: string } | null>(null);

  // Step 2: Pre-index connected state
  const [connectedRepo, setConnectedRepo] = useState<RepositoryOut | null>(null);
  const [isStartingIndex, setIsStartingIndex] = useState(false);

  // Step 3: Progress State
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobReqId, setJobReqId] = useState<string | undefined>(undefined);

  // Polling health tracking (tracks consecutive errors and continuous error duration, not total job duration)
  const [pollExhausted, setPollExhausted] = useState(false);
  const consecutiveErrorsRef = useRef<number>(0);
  const continuousErrorStartTimeRef = useRef<number | null>(null);

  // Normalize input
  const handleBlurOrPaste = () => {
    let input = repoInput.trim();
    if (!input) {
      setNormalizedRepo(null);
      return;
    }

    // basic strip for URL
    try {
      if (input.startsWith('http')) {
        const url = new URL(input);
        if (url.hostname === 'github.com') {
          const pathname = url.pathname.replace(/^\//, '').replace(/\.git$/, '');
          const parts = pathname.split('/');
          if (parts.length >= 2) {
            input = `${parts[0]}/${parts[1]}`;
          }
        }
      }
    } catch {
      // Ignore
    }

    // Validation rules
    const [owner, name] = input.split('/');
    if (
      !owner || !name ||
      !/^[a-zA-Z0-9-]+$/.test(owner) ||
      !/^[a-zA-Z0-9._-]+$/.test(name) ||
      name.includes('..') || owner.includes('..')
    ) {
      setNormalizedRepo(null);
      return;
    }

    setRepoInput(input);
    setNormalizedRepo(input);
  };

  const handleConnect = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !normalizedRepo) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      const connectUrl = `https://github.com/${normalizedRepo}`;
      const repo = await api.connectRepository(connectUrl);

      setConnectedRepo(repo);
      onSuccess(repo);
    } catch (err: unknown) {
      const apiErr = err as ApiError;

      if (apiErr.code === 'UNAUTHENTICATED' || apiErr.status === 401) {
        router.push('/?error=session_expired');
        return;
      }

      let msg: string;
      if (apiErr.code === 'INVALID_REQUEST') {
        msg = 'Enter a repository as owner/name.';
      } else if (apiErr.code === 'GITHUB_API_ERROR' || apiErr.status === 404) {
        msg = "We couldn't find this repository, or you don't have access to it.";
      } else if (apiErr.status === 403) {
        msg = "You don't have access to this repository.";
      } else if (apiErr.status === 409 || apiErr.code === 'ALREADY_EXISTS') {
        msg = "This repository is already connected.";
      } else if (apiErr.status === 429) {
        msg = "Too many requests. Please wait a moment.";
      } else if (apiErr.status === 503 || apiErr.status === 502) {
        msg = "Temporarily unavailable. Please try again.";
      } else if (!apiErr.status) {
        msg = "Can't reach the server.";
      } else {
        msg = "Something went wrong. Please try again.";
      }

      setFormError({ message: msg, reqId: apiErr.requestId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartIndexing = async () => {
    if (!connectedRepo || isStartingIndex) return;
    setIsStartingIndex(true);
    setFormError(null);
    setPollExhausted(false);
    consecutiveErrorsRef.current = 0;
    continuousErrorStartTimeRef.current = null;

    try {
      const data = await api.analyzeRepository(connectedRepo.id, branchInput || null);

      setJobId(data.job_id);
      setJobStatus('QUEUED');
      if (onAnalyzeStart) onAnalyzeStart();
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setFormError({ message: "Something went wrong. Please try again.", reqId: apiErr?.requestId });
    } finally {
      setIsStartingIndex(false);
    }
  };

  /** Manual refresh after poll exhaustion. */
  const handleManualPollRefresh = () => {
    setPollExhausted(false);
    consecutiveErrorsRef.current = 0;
    continuousErrorStartTimeRef.current = null;
    // Re-trigger polling by "resetting" jobId
    if (jobId && connectedRepo) {
      const currentJobId = jobId;
      setJobId(null);
      // Small delay so effect sees the transition
      setTimeout(() => setJobId(currentJobId), 50);
    }
  };

  // Polling logic
  useEffect(() => {
    if (!jobId || !connectedRepo) return;

    let timeoutId: NodeJS.Timeout;
    let isMounted = true;
    let currentInterval = 2000;
    const abortController = new AbortController();

    const poll = async () => {
      if (!isMounted) return;
      if (document.hidden) {
        // Pause if tab is hidden
        timeoutId = setTimeout(poll, currentInterval);
        return;
      }

      // Check consecutive error count and continuous error duration limits
      const continuousErrorElapsed = continuousErrorStartTimeRef.current !== null
        ? Date.now() - continuousErrorStartTimeRef.current
        : 0;

      if (consecutiveErrorsRef.current >= MAX_POLL_ERRORS || continuousErrorElapsed >= MAX_CONTINUOUS_ERROR_DURATION_MS) {
        if (isMounted) {
          setPollExhausted(true);
        }
        return;
      }

      try {
        const data = await api.getIndexJob(connectedRepo.id, jobId, { signal: abortController.signal });

        if (isMounted) {
          setJobStatus(data.status);
          // Reset consecutive errors and continuous error timer on any successful response
          consecutiveErrorsRef.current = 0;
          continuousErrorStartTimeRef.current = null;

          if (data.status === 'FAILED') {
            setJobError(getFailureMessage(data.failure_code));
          }

          if (data.status !== 'READY' && data.status !== 'FAILED') {
            // backoff max to 8s
            currentInterval = Math.min(currentInterval + 1000, 8000);
            timeoutId = setTimeout(poll, currentInterval);
          }
        }
      } catch (err: unknown) {
        if (!isMounted || abortController.signal.aborted) return;
        const apiErr = err as ApiError;

        // On 401, stop polling and redirect
        if (apiErr?.status === 401) {
          router.push('/?error=session_expired');
          return;
        }

        // On 404, stop polling and show mapped copy
        if (apiErr?.status === 404) {
          if (isMounted) {
            setJobError(mapErrorToCopy(apiErr) || "We couldn't find that.");
            setJobReqId(apiErr?.requestId);
            setJobStatus('FAILED');
          }
          return;
        }

        // Track consecutive errors and continuous error time
        consecutiveErrorsRef.current += 1;
        if (continuousErrorStartTimeRef.current === null) {
          continuousErrorStartTimeRef.current = Date.now();
        }

        const continuousErrorElapsed = Date.now() - continuousErrorStartTimeRef.current;
        if (consecutiveErrorsRef.current >= MAX_POLL_ERRORS || continuousErrorElapsed >= MAX_CONTINUOUS_ERROR_DURATION_MS) {
          if (isMounted) {
            setPollExhausted(true);
          }
          return;
        }

        if (apiErr?.status === 429) {
          // Retry-After already capped at 120s by fetchWrapper
          currentInterval = apiErr.retryAfter ? apiErr.retryAfter * 1000 : 8000;
          timeoutId = setTimeout(poll, currentInterval);
          return;
        }

        currentInterval = Math.min(currentInterval + 2000, 8000);
        timeoutId = setTimeout(poll, currentInterval);
      }
    };

    poll();
    return () => {
      isMounted = false;
      abortController.abort();
      clearTimeout(timeoutId);
    };
  }, [jobId, connectedRepo, router]);

  // Reset state when fully closed
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setRepoInput('');
        setNormalizedRepo(null);
        setBranchInput('');
        setShowBranch(false);
        setFormError(null);
        setConnectedRepo(null);
        setJobId(null);
        setJobStatus(null);
        setJobError(null);
        setPollExhausted(false);
        consecutiveErrorsRef.current = 0;
        continuousErrorStartTimeRef.current = null;
      }, 300);
      return () => clearTimeout(t);
    } else if (initialRepository) {
      const t = setTimeout(() => {
        setConnectedRepo(initialRepository);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [open, initialRepository]);

  const preventClose = isSubmitting || isStartingIndex;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(val) => {
        if (!val && preventClose) return;
        onOpenChange(val);
      }}
    >
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              onEscapeKeyDown={(e) => {
                if (preventClose) e.preventDefault();
              }}
              onPointerDownOutside={(e) => {
                if (preventClose) e.preventDefault();
              }}
            >
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 h-full w-full max-w-[480px] bg-background border-l border-border shadow-2xl z-50 flex flex-col focus:outline-none"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <Dialog.Title className="text-lg font-semibold text-foreground">
                    Connect repository
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      disabled={preventClose}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors p-1"
                      aria-label="Close"
                    >
                      <X size={20} />
                    </button>
                  </Dialog.Close>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6" aria-live="polite">

                  {/* Step 1: Form */}
                  {!connectedRepo && (
                    <form onSubmit={handleConnect} className="space-y-6">
                      <div>
                        <label htmlFor="repoUrl" className="block text-sm font-medium text-foreground mb-2">
                          Repository
                        </label>
                        <input
                          id="repoUrl"
                          type="text"
                          autoFocus
                          disabled={isSubmitting}
                          placeholder="owner/name or GitHub URL"
                          className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                          value={repoInput}
                          onChange={(e) => setRepoInput(e.target.value)}
                          onBlur={handleBlurOrPaste}
                          onPaste={() => setTimeout(handleBlurOrPaste, 10)}
                          aria-describedby={formError ? "repo-error" : undefined}
                        />
                        {normalizedRepo && repoInput === normalizedRepo && (
                          <p className="mt-2 text-xs text-muted-foreground font-mono">
                            Will connect: {normalizedRepo}
                          </p>
                        )}
                        {formError && (
                          <div id="repo-error" className="mt-2 text-sm text-destructive flex flex-col gap-1">
                            <span className="flex items-center gap-1"><AlertCircle size={14}/> {formError.message}</span>
                            {formError.message.includes('already connected') && (
                              <Link href={`/repositories`} className="text-accent hover:underline text-xs" onClick={() => onOpenChange(false)}>
                                Open it
                              </Link>
                            )}
                            <RequestIdRef id={formError.reqId} />
                          </div>
                        )}
                      </div>


                      <Button
                        type="submit"
                        variant="secondary"
                        className="w-full"
                        disabled={isSubmitting || !normalizedRepo}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 size={16} className="animate-spin mr-2" />
                            Connecting…
                          </>
                        ) : 'Connect repository'}
                      </Button>
                    </form>
                  )}

                  {/* Step 2: Post-connect, pre-index OR indexing */}
                  {connectedRepo && !jobId && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-8 space-y-6"
                    >
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/20 text-accent mb-4">
                        <CheckCircle2 size={32} />
                      </div>
                      <h3 className="text-xl font-medium text-foreground">Connected.</h3>
                      <p className="text-sm text-muted-foreground">
                        Index it to enable questions and architecture search.
                      </p>

                      <div className="w-full border border-border rounded-md overflow-hidden text-left">
                        <button
                          type="button"
                          onClick={() => setShowBranch(!showBranch)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-surface hover:bg-muted/10 text-sm font-medium text-foreground transition-colors"
                        >
                          Branch (optional)
                          <ChevronRight size={16} className={`transition-transform ${showBranch ? 'rotate-90' : ''}`} />
                        </button>
                        <AnimatePresence>
                          {showBranch && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: 'auto' }}
                              exit={{ height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 border-t border-border bg-background">
                                <p className="text-xs text-muted-foreground mb-2">
                                  Leave empty to use the repository&apos;s default branch.
                                </p>
                                <input
                                  type="text"
                                  disabled={isStartingIndex}
                                  placeholder="e.g. main, dev"
                                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                                  value={branchInput}
                                  onChange={(e) => setBranchInput(e.target.value)}
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {formError && (
                        <div className="text-sm text-destructive flex flex-col items-center gap-1">
                          <span className="flex items-center gap-1"><AlertCircle size={14}/> {formError.message}</span>
                          <RequestIdRef id={formError.reqId} />
                        </div>
                      )}

                      <Button
                        onClick={handleStartIndexing}
                        disabled={isStartingIndex}
                        className="w-full"
                      >
                        {isStartingIndex ? (
                          <>
                            <Loader2 size={16} className="animate-spin mr-2" />
                            Starting...
                          </>
                        ) : 'Index repository'}
                      </Button>
                    </motion.div>
                  )}

                  {/* Step 3: Progress View */}
                  {connectedRepo && jobId && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-8 py-4"
                    >
                      <h3 className="text-lg font-medium text-foreground">Indexing in progress</h3>

                      <div className="relative pl-6 space-y-8">
                        {/* Connector Line */}
                        <div className="absolute left-2.5 top-2 bottom-2 w-[2px] bg-border rounded-full overflow-hidden">
                           <motion.div
                             className="absolute top-0 left-0 right-0 bg-accent w-full origin-top"
                             initial={{ scaleY: 0 }}
                             animate={{
                               scaleY: jobStatus === 'READY' ? 1 :
                                      jobStatus === 'ANALYZING' ? 0.75 :
                                      jobStatus === 'INDEXING' ? 0.5 :
                                      jobStatus === 'FETCHING' ? 0.25 : 0
                             }}
                             transition={{ duration: shouldReduceMotion ? 0 : 0.5, ease: 'easeOut' }}
                             style={{ height: '100%' }}
                           />
                        </div>

                        {STAGES.map((stage) => {
                           const stageIndex = STAGES.indexOf(stage);
                           const currentIndex = jobStatus && (STAGES as readonly string[]).includes(jobStatus)
                             ? STAGES.indexOf(jobStatus as typeof STAGES[number])
                             : STAGES.indexOf('QUEUED');

                           const isCompleted = stageIndex < currentIndex || jobStatus === 'READY';
                           const isCurrent = stageIndex === currentIndex && jobStatus !== 'FAILED' && jobStatus !== 'READY';

                           return (
                             <div key={stage} className="relative">
                               {/* Node */}
                               <div className={`absolute -left-[27px] w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center bg-background z-10 transition-colors duration-300 ${isCompleted ? 'border-accent text-accent' : isCurrent ? 'border-accent' : 'border-border'}`}>
                                 {isCompleted && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><CheckCircle2 size={10} /></motion.div>}
                                 {isCurrent && <motion.div className="w-2 h-2 rounded-full bg-accent" layoutId="active-stage" />}
                               </div>

                               <div className={`text-sm font-medium transition-colors duration-300 ${isCompleted || isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                                 {stage.charAt(0) + stage.slice(1).toLowerCase()}
                                 {isCurrent && (
                                   shouldReduceMotion
                                     ? <span className="inline-block ml-2 text-accent text-xs">In progress</span>
                                     : (
                                       <motion.span
                                         initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                         className="inline-block ml-2 w-3 text-accent"
                                       >
                                         <span className="animate-pulse">...</span>
                                       </motion.span>
                                     )
                                 )}
                               </div>
                             </div>
                           );
                        })}
                      </div>

                      {/* Poll exhaustion notice */}
                      {pollExhausted && jobStatus !== 'READY' && jobStatus !== 'FAILED' && (
                        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-md text-sm mt-4">
                          <p className="font-semibold flex items-center gap-2"><AlertCircle size={16}/> Can&apos;t refresh status</p>
                          <p className="mt-1 opacity-90">We stopped polling after too many errors. The job may still be running.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 bg-background text-foreground"
                            onClick={handleManualPollRefresh}
                          >
                            <RefreshCw size={14} className="mr-2" /> Refresh status
                          </Button>
                        </div>
                      )}

                      {jobStatus === 'FAILED' && (
                        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-md text-sm mt-6">
                          <p className="font-semibold flex items-center gap-2"><AlertCircle size={16}/> Indexing Failed</p>
                          <p className="mt-1 opacity-90">{jobError || DEFAULT_FAILURE_MESSAGE}</p>
                          <RequestIdRef id={jobReqId} />
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-4 bg-background text-foreground"
                            onClick={handleStartIndexing}
                            disabled={isStartingIndex}
                          >
                            <RefreshCw size={14} className="mr-2" /> Retry
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  )}

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border bg-surface mt-auto">
                  {jobStatus === 'READY' ? (
                    <Button
                      className="w-full"
                      onClick={() => {
                        onOpenChange(false);
                        router.push(`/repositories/${connectedRepo?.id}`);
                      }}
                    >
                      Open repository
                    </Button>
                  ) : (
                    <div className="flex flex-col gap-3 text-center">
                      {jobId && jobStatus !== 'FAILED' && !pollExhausted && (
                         <p className="text-xs text-muted-foreground">You can close this. Progress shows on the repository&apos;s row.</p>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={preventClose}
                        className="w-full"
                      >
                        {connectedRepo && !jobId ? 'Close' : (jobId ? 'Dismiss' : 'Cancel')}
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
