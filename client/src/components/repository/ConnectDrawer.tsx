import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitBranch,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Copy,
  Check,
  RotateCcw,
  Lock,
} from 'lucide-react';
import { GithubIcon } from '../ui/GithubIcon';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '../ui/drawer';
import { Button } from '../ui/button';
import { Input } from '../components/../ui/input';
import { realApi, ApiError, RepositoryDetailOut, IndexJobOut } from '../../lib/api';
import { getFailureMessage } from '../../lib/status';

interface ConnectDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
}

type ConnectStep = 'input' | 'configure' | 'indexing' | 'ready' | 'failed';

const STAGES = [
  { id: 'QUEUED', label: 'Queued', description: 'Queued in cluster pipeline' },
  { id: 'FETCHING', label: 'Fetching', description: 'Clone and tree-sitter tarball unpacked' },
  { id: 'INDEXING', label: 'Indexing', description: 'Parsing AST symbol hierarchy and chunk boundaries' },
  { id: 'ANALYZING', label: 'Analyzing', description: 'Generating dense vector embeddings and pgvector sync' },
  { id: 'READY', label: 'Ready', description: 'Citations available for natural-language queries' },
] as const;

export function ConnectDrawer({ open, onOpenChange, onConnected }: ConnectDrawerProps) {
  const navigate = useNavigate();
  const [step, setStep] = React.useState<ConnectStep>('input');
  const [repoUrl, setRepoUrl] = React.useState('');
  const [branch, setBranch] = React.useState('main');
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [errorTraceId, setErrorTraceId] = React.useState<string | null>(null);
  const [isAlreadyConnected, setIsAlreadyConnected] = React.useState(false);
  const [copiedTrace, setCopiedTrace] = React.useState(false);

  // Connected repository & job tracking
  const [connectedRepo, setConnectedRepo] = React.useState<RepositoryDetailOut | null>(null);
  const [activeJob, setActiveJob] = React.useState<IndexJobOut | null>(null);

  const pollTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timers on unmount or drawer close
  const clearPollTimer = React.useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    if (!open) {
      clearPollTimer();
      const timer = setTimeout(() => {
        setStep('input');
        setRepoUrl('');
        setErrorMsg(null);
        setErrorTraceId(null);
        setIsAlreadyConnected(false);
        setConnectedRepo(null);
        setActiveJob(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, clearPollTimer]);

  // Map API errors to human-friendly copy
  const mapConnectError = (err: unknown): { message: string; traceId?: string; isConflict?: boolean } => {
    if (err instanceof ApiError) {
      const traceId = err.requestId;
      if (err.code === 'ALREADY_EXISTS' || err.status === 409) {
        return {
          message: 'This repository is already connected to your account.',
          traceId,
          isConflict: true,
        };
      }
      if (err.code === 'INVALID_REQUEST' || err.status === 400) {
        return {
          message: 'Invalid repository URL or format. Please enter a valid GitHub repository URL.',
          traceId,
        };
      }
      if (err.code === 'GITHUB_API_ERROR' || err.status === 502) {
        return {
          message:
            "We couldn't find this repository, or you don't have access to it. Verify your GitHub organization has granted third-party application permissions to Codebase Intellisense.",
          traceId,
        };
      }
      if (err.status === 429) {
        return {
          message: 'Too many requests. Please wait a moment and try again.',
          traceId,
        };
      }
      if (err.status === 503) {
        return {
          message: 'GitHub or indexing service is currently unavailable. Please try again later.',
          traceId,
        };
      }
      return {
        message: err.message || 'Failed to connect repository. Please verify the URL and your access.',
        traceId,
      };
    }
    if (err instanceof Error) {
      return { message: err.message };
    }
    return { message: 'Failed to connect repository. Please verify the URL and your access.' };
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) {
      setErrorMsg('Please enter a GitHub repository URL');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setErrorTraceId(null);
    setIsAlreadyConnected(false);

    try {
      const repo = await realApi.connectRepository(repoUrl.trim());
      setConnectedRepo(repo);
      setStep('configure');
      if (onConnected) {
        onConnected();
      }
    } catch (err: unknown) {
      const mapped = mapConnectError(err);
      setErrorMsg(mapped.message);
      if (mapped.traceId) setErrorTraceId(mapped.traceId);
      if (mapped.isConflict) setIsAlreadyConnected(true);
    } finally {
      setLoading(false);
    }
  };

  // Poll indexing job until terminal status
  const startPollingJob = React.useCallback(
    (repoId: string, jobId: string) => {
      clearPollTimer();

      const poll = async () => {
        try {
          const job = await realApi.getIndexJob(repoId, jobId);
          setActiveJob(job);

          if (job.status === 'READY') {
            setStep('ready');
            if (onConnected) onConnected();
            return;
          }

          if (job.status === 'FAILED') {
            setStep('failed');
            if (onConnected) onConnected();
            return;
          }

          // Continue polling while queued, fetching, indexing, or analyzing
          pollTimerRef.current = setTimeout(poll, 2000);
        } catch {
          // Retry poll after 3s on transient hiccup
          pollTimerRef.current = setTimeout(poll, 3000);
        }
      };

      poll();
    },
    [clearPollTimer, onConnected]
  );

  const handleStartIndexing = async () => {
    if (!connectedRepo) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const result = await realApi.analyzeRepository(connectedRepo.id, branch.trim() || undefined);
      setStep('indexing');
      startPollingJob(connectedRepo.id, result.job_id);
      if (onConnected) onConnected();
    } catch (err: unknown) {
      const mapped = mapConnectError(err);
      setErrorMsg(mapped.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTrace = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTrace(true);
    setTimeout(() => setCopiedTrace(false), 2000);
  };

  const getStageIndex = (status?: string | null) => {
    if (!status) return 0;
    const idx = STAGES.findIndex((s) => s.id === status);
    return idx === -1 ? 0 : idx;
  };

  const currentStageIndex = getStageIndex(activeJob?.status || 'QUEUED');

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right" className="flex flex-col justify-between max-w-lg">
        <div>
          <DrawerHeader>
            <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-muted)] mb-1">
              <span>REPOSITORY INDEXING</span>
              <span>·</span>
              <span>Tree-sitter AST</span>
            </div>
            <DrawerTitle>
              {connectedRepo ? `Indexing ${connectedRepo.owner}/${connectedRepo.name}` : 'Connect repository'}
            </DrawerTitle>
            <DrawerDescription>
              {connectedRepo
                ? 'Building AST symbol table and reference dependency graph.'
                : 'Connect a public or private GitHub repository to parse symbol hierarchies and index code vectors on demand.'}
            </DrawerDescription>
          </DrawerHeader>

          {/* Step 1: Input GitHub URL (connect_form.png / connect_form_with_errors.png) */}
          {step === 'input' && (
            <form onSubmit={handleConnectSubmit} className="space-y-5 px-4 mt-2">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                  Repository identifier
                </label>
                <div className="text-[11px] text-[var(--color-muted)] mb-2">
                  Enter the repository slug or full URL
                </div>
                <div className="relative">
                  <Input
                    value={repoUrl}
                    onChange={(e) => {
                      setRepoUrl(e.target.value);
                      setErrorMsg(null);
                      setIsAlreadyConnected(false);
                    }}
                    placeholder="https://github.com/owner/repository"
                    error={!!errorMsg}
                    className="font-mono text-xs pl-8 bg-[var(--color-surface)]"
                    autoFocus
                  />
                  <GithubIcon size={14} className="absolute left-2.5 top-2.5 text-[var(--color-muted)]" />
                </div>

                {/* Error Banner */}
                {errorMsg && (
                  <div className="mt-3 p-3 rounded-[var(--radius-control)] border border-[var(--color-error-border)] bg-[var(--color-error-tint)] text-xs text-[var(--color-error)] space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <div className="leading-relaxed">{errorMsg}</div>
                    </div>

                    {isAlreadyConnected && (
                      <div className="pt-1 border-t border-[var(--color-error-border)]/50 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            onOpenChange(false);
                            navigate('/dashboard');
                          }}
                          className="font-medium underline hover:text-[var(--color-text)] transition"
                        >
                          View connected repositories →
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Diagnostic Trace on Error */}
                {errorTraceId && (
                  <div className="mt-2.5 p-2 rounded-[var(--radius-control)] bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-between text-[11px] font-mono text-[var(--color-muted)]">
                    <div className="truncate">
                      <span>Reference: </span>
                      <span className="text-[var(--color-text)]">{errorTraceId}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyTrace(errorTraceId)}
                      className="p-1 hover:text-[var(--color-text)] transition"
                      title="Copy diagnostic reference"
                    >
                      {copiedTrace ? <Check size={12} className="text-[var(--color-accent)]" /> : <Copy size={12} />}
                    </button>
                  </div>
                )}
              </div>

              {/* Scope & Permissions info card */}
              <div className="p-3 rounded-[var(--radius-control)] bg-[var(--color-raised)]/60 border border-[var(--color-border)] text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Verification Scope
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)]">
                    AST Indexing: Ready
                  </span>
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)] leading-normal">
                  Static analysis parses hierarchical symbol trees across all commits on branch <code className="font-mono text-[var(--color-accent)]">{branch}</code>.
                </p>
                <div className="pt-1 flex items-center gap-1.5 text-[10px] font-mono text-[var(--color-muted)]">
                  <Lock size={11} />
                  <span>Read-only access. Zero retention ephemeral memory.</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-2">
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Verifying repository...</span>
                    </>
                  ) : (
                    <span>Connect repository</span>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onOpenChange(false)}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Step 2: Configure & Confirm Branch (connect_index_step.png) */}
          {step === 'configure' && connectedRepo && (
            <div className="space-y-5 px-4 mt-2">
              <div className="p-3 rounded-[var(--radius-control)] bg-[var(--color-raised)] border border-[var(--color-border)]">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Repository Verified
                </div>
                <div className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-1.5 mt-1 font-mono">
                  <GitBranch size={14} className="text-[var(--color-accent)]" />
                  <span>{connectedRepo.owner}/{connectedRepo.name}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text)] mb-1.5">
                  Target Branch
                </label>
                <Input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="font-mono text-xs bg-[var(--color-surface)]"
                  placeholder="main"
                />
                <p className="text-[11px] text-[var(--color-muted)] mt-1.5">
                  The primary branch to parse concrete syntax trees and generate dense vectors.
                </p>
              </div>

              <div className="p-3 rounded-[var(--radius-control)] bg-[var(--color-raised)]/60 border border-[var(--color-border)] text-xs space-y-2">
                <div className="font-semibold text-[var(--color-text)]">Pipeline Sequence</div>
                <ul className="space-y-1.5 text-[var(--color-text-secondary)] text-[11px]">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-[var(--color-accent)]" />
                    <span>Tree-sitter concrete syntax parsing</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-[var(--color-accent)]" />
                    <span>Hierarchical symbol and chunk boundary mapping</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-[var(--color-accent)]" />
                    <span>Gemini dense embedding generation & pgvector sync</span>
                  </li>
                </ul>
              </div>

              <div className="pt-2 flex gap-2">
                <Button variant="secondary" onClick={() => setStep('input')} className="w-1/3">
                  Back
                </Button>
                <Button onClick={handleStartIndexing} disabled={loading} className="w-2/3">
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Queueing...</span>
                    </>
                  ) : (
                    <span>Start Indexing</span>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Indexing Progress (connect_indexing_progress.png - NO percentage, stage based) */}
          {step === 'indexing' && (
            <div className="space-y-5 px-4 mt-4">
              <div className="space-y-4">
                {STAGES.map((s, index) => {
                  const isCompleted = index < currentStageIndex;
                  const isCurrent = index === currentStageIndex;
                  const isUpcoming = index > currentStageIndex;

                  return (
                    <div
                      key={s.id}
                      className={`flex items-start gap-3 p-3 rounded-[var(--radius-control)] border transition-all ${
                        isCurrent
                          ? 'bg-[var(--color-raised)] border-[var(--color-accent-border)]'
                          : isCompleted
                          ? 'bg-[var(--color-surface)] border-[var(--color-border)]/60'
                          : 'bg-transparent border-transparent opacity-50'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isCompleted && (
                          <CheckCircle2 size={16} className="text-[var(--color-accent)]" />
                        )}
                        {isCurrent && (
                          <Loader2 size={16} className="animate-spin text-[var(--color-warning)]" />
                        )}
                        {isUpcoming && (
                          <div className="h-4 w-4 rounded-full border border-[var(--color-border)]" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-semibold ${
                              isCurrent
                                ? 'text-[var(--color-text)]'
                                : isCompleted
                                ? 'text-[var(--color-text)]'
                                : 'text-[var(--color-muted)]'
                            }`}
                          >
                            {s.label}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-warning-tint)] text-[var(--color-warning)] font-medium">
                              In progress
                            </span>
                          )}
                          {isCompleted && (
                            <span className="text-[10px] font-mono text-[var(--color-accent)]">
                              Completed
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                          {s.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Informational Callout */}
              <div className="p-3 rounded-[var(--radius-control)] bg-[var(--color-raised)]/50 border border-[var(--color-border)] text-xs text-[var(--color-muted)] flex items-center gap-2">
                <Clock size={13} className="shrink-0 text-[var(--color-accent)]" />
                <span>You can close this drawer. Indexing runs asynchronously in the worker.</span>
              </div>

              <div className="pt-2">
                <Button
                  variant="secondary"
                  onClick={() => onOpenChange(false)}
                  className="w-full"
                >
                  Close drawer
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Ready State (connect_ready_failed.png - Ready view) */}
          {step === 'ready' && connectedRepo && (
            <div className="space-y-6 px-4 mt-6 text-center">
              <div className="h-12 w-12 rounded-full bg-[var(--color-accent-tint)] border border-[var(--color-accent-border)] flex items-center justify-center text-[var(--color-accent)] mx-auto">
                <CheckCircle2 size={24} />
              </div>

              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--color-accent-tint)] border border-[var(--color-accent-border)] text-xs font-medium text-[var(--color-accent)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                  <span>Ready</span>
                </div>
                <h3 className="text-base font-semibold text-[var(--color-text)]">
                  Repository indexed and verified
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto leading-relaxed">
                  Every query against this repository will cite verifiable file and line coordinates from the indexed AST.
                </p>
              </div>

              <div className="pt-4">
                <Button
                  className="w-full"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/repositories/${connectedRepo.id}`);
                  }}
                >
                  <span>Open repository</span>
                  <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Failed State (connect_ready_failed.png - Failed view) */}
          {step === 'failed' && (
            <div className="space-y-5 px-4 mt-6 text-center">
              <div className="h-12 w-12 rounded-full bg-[var(--color-error-tint)] border border-[var(--color-error-border)] flex items-center justify-center text-[var(--color-error)] mx-auto">
                <AlertCircle size={24} />
              </div>

              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--color-error-tint)] border border-[var(--color-error-border)] text-xs font-medium text-[var(--color-error)]">
                  <span>Failed</span>
                </div>
                <h3 className="text-base font-semibold text-[var(--color-text)]">
                  Indexing failed
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto leading-relaxed">
                  {getFailureMessage(activeJob?.failure_code)}
                </p>
              </div>

              {activeJob && (
                <div className="p-3 rounded-[var(--radius-control)] bg-[var(--color-raised)] border border-[var(--color-border)] text-left font-mono text-[11px] text-[var(--color-muted)] space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text)]">
                    Forensic Diagnostic Trace
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Code: {activeJob.failure_code || 'INTERNAL_ERROR'}</span>
                    <span>Ref: {activeJob.id.slice(0, 8)}</span>
                  </div>
                </div>
              )}

              <div className="pt-3 flex gap-2">
                <Button variant="secondary" onClick={() => onOpenChange(false)} className="w-1/2">
                  Close
                </Button>
                <Button onClick={handleStartIndexing} className="w-1/2">
                  <RotateCcw size={13} />
                  <span>Retry</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
