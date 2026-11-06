import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../ui/MaterialIcon';
import { GithubIcon } from '../ui/GithubIcon';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '../ui/drawer';
import { Button } from '../ui/button';
import { Input } from '../components/../ui/input';
import { realApi, ApiError, RepositoryDetailOut, IndexJobOut } from '../../lib/api';
import { getFailureMessage } from '../../lib/status';
import { useIndexingStatus } from '../../lib/useIndexingStatus';

interface ConnectDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
}

type ConnectStep = 'input' | 'configure' | 'indexing' | 'ready' | 'failed';

const STAGES = [
  { id: 'QUEUED', label: 'Queued', description: 'Waiting to start processing' },
  { id: 'FETCHING', label: 'Fetching', description: 'Downloading repository files' },
  { id: 'INDEXING', label: 'Indexing', description: 'Analyzing code structure & symbols' },
  { id: 'ANALYZING', label: 'Analyzing', description: 'Building search index' },
  { id: 'READY', label: 'Ready', description: 'Ready to search & explore' },
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
  const { activeJobRepo } = useIndexingStatus();

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
            "We couldn't find this repository, or you don't have access to it. Verify your GitHub organization has granted third-party application permissions to RepoMind.",
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
            <DrawerTitle>
              {connectedRepo ? `Indexing ${connectedRepo.owner}/${connectedRepo.name}` : 'Connect repository'}
            </DrawerTitle>
            <DrawerDescription>
              {connectedRepo
                ? 'Analyzing code structure, symbols, and architecture.'
                : 'Connect a public or private GitHub repository to search code, explore architecture, and chat with AI.'}
            </DrawerDescription>
          </DrawerHeader>

          {/* Active background indexing banner */}
          {activeJobRepo && step === 'input' && (
            <div className="mx-4 mt-2 p-3 rounded-[var(--radius-control)] bg-[var(--color-raised)] border border-[rgba(253,214,99,0.3)] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-medium text-[var(--color-text)] min-w-0">
                  <MaterialIcon name="sync" size={14} spin className="text-[var(--color-warning)] shrink-0" />
                  <span className="truncate">{activeJobRepo.name} is indexing…</span>
                </div>
                <span className="font-mono text-[10px] text-[var(--color-warning)] font-medium shrink-0">
                  {activeJobRepo.latest_job_status?.toLowerCase()}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[var(--color-surface)] overflow-hidden">
                <div
                  className="h-full bg-[var(--color-warning)] rounded-full transition-all duration-500"
                  style={{
                    width: activeJobRepo.latest_job_status === 'FETCHING' ? '35%' : activeJobRepo.latest_job_status === 'INDEXING' ? '70%' : '90%'
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/repositories/${activeJobRepo.id}`);
                }}
                className="text-[11px] text-[var(--color-accent)] hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
              >
                <span>View repository overview →</span>
              </button>
            </div>
          )}

          {/* Step 1: Input GitHub URL (connect_form.png / connect_form_with_errors.png) */}
          {step === 'input' && (
            <form onSubmit={handleConnectSubmit} className="space-y-5 px-4 mt-2">
              <div>
                <label
                  htmlFor="repo-identifier-input"
                  className="block text-xs font-semibold text-[var(--color-text)] mb-1"
                >
                  Repository identifier
                </label>
                <div id="repo-identifier-desc" className="text-[11px] text-[var(--color-muted)] mb-2">
                  Enter the repository slug or full URL
                </div>
                <div className="relative">
                  <Input
                    id="repo-identifier-input"
                    value={repoUrl}
                    onChange={(e) => {
                      setRepoUrl(e.target.value);
                      setErrorMsg(null);
                      setIsAlreadyConnected(false);
                    }}
                    placeholder="https://github.com/owner/repository"
                    error={!!errorMsg}
                    aria-invalid={!!errorMsg}
                    aria-describedby={errorMsg ? "repo-identifier-error" : "repo-identifier-desc"}
                    className="font-mono text-xs pl-8 bg-[var(--color-surface)]"
                    autoFocus
                  />
                  <GithubIcon size={14} className="absolute left-2.5 top-2.5 text-[var(--color-muted)]" aria-hidden="true" />
                </div>

                {/* Error Banner */}
                {errorMsg && (
                  <div
                    id="repo-identifier-error"
                    role="alert"
                    aria-live="assertive"
                    className="mt-3 p-3 rounded-[var(--radius-control)] border border-[var(--color-error-border)] bg-[var(--color-error-tint)] text-xs text-[var(--color-error)] space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <MaterialIcon name="error" size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="leading-relaxed">{errorMsg}</div>
                    </div>

                    {isAlreadyConnected && (
                      <div className="pt-1 border-t border-[var(--color-error-border)]/50 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            onOpenChange(false);
                            navigate('/repositories');
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
                      {copiedTrace ? <MaterialIcon name="check" size={14} className="text-[var(--color-accent)]" /> : <MaterialIcon name="content_copy" size={14} />}
                    </button>
                  </div>
                )}
              </div>

              {/* Scope & Permissions info card */}
              <div className="p-3 rounded-[var(--radius-control)] bg-[var(--color-raised)]/60 border border-[var(--color-border)] text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Security & Access
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)]">
                    Read-Only
                  </span>
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)] leading-normal">
                  Analyzes repository files on branch <code className="font-mono text-[var(--color-accent)]">{branch}</code> for code search and navigation.
                </p>
                <div className="pt-1 flex items-center gap-1.5 text-[10px] font-mono text-[var(--color-muted)]">
                  <MaterialIcon name="lock" size={12} />
                  <span>Read-only GitHub repository access for indexing and search.</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-2">
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <MaterialIcon name="sync" size={16} spin />
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
                  <MaterialIcon name="call_split" size={16} className="text-[var(--color-accent)]" />
                  <span>{connectedRepo.owner}/{connectedRepo.name}</span>
                </div>
              </div>

              <div>
                <label htmlFor="target-branch-input" className="block text-xs font-semibold text-[var(--color-text)] mb-1.5">
                  Target Branch
                </label>
                <Input
                  id="target-branch-input"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="font-mono text-xs bg-[var(--color-surface)]"
                  placeholder="main"
                />
                <p className="text-[11px] text-[var(--color-muted)] mt-1.5">
                  The primary branch to analyze for code search and navigation.
                </p>
              </div>

              <div className="p-3 rounded-[var(--radius-control)] bg-[var(--color-raised)]/60 border border-[var(--color-border)] text-xs space-y-2">
                <div className="font-semibold text-[var(--color-text)]">What happens next</div>
                <ul className="space-y-1.5 text-[var(--color-text-secondary)] text-[11px]">
                  <li className="flex items-center gap-2">
                    <MaterialIcon name="check_circle" size={14} className="text-[var(--color-accent)]" fill={1} />
                    <span>Download and verify repository files</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <MaterialIcon name="check_circle" size={14} className="text-[var(--color-accent)]" fill={1} />
                    <span>Extract code symbols, functions, and architecture</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <MaterialIcon name="check_circle" size={14} className="text-[var(--color-accent)]" fill={1} />
                    <span>Build fast semantic search index</span>
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
                      <MaterialIcon name="sync" size={16} spin />
                      <span>Queueing...</span>
                    </>
                  ) : (
                    <span>Start Indexing</span>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Indexing Progress */}
          {step === 'indexing' && (
            <div className="space-y-5 px-4 mt-4" role="status" aria-label="Indexing progress stages" aria-live="polite">
              {/* Overall Linear Progress Bar */}
              <div className="p-3.5 rounded-[var(--radius-control)] bg-[var(--color-raised)] border border-[var(--color-border)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-[var(--color-text)]">
                    <MaterialIcon name="sync" size={15} spin className="text-[var(--color-warning)]" />
                    <span>Indexing progress</span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[var(--color-accent)] tabular-nums">
                    {Math.round(((currentStageIndex + 1) / STAGES.length) * 100)}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]/50 overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.round(((currentStageIndex + 1) / STAGES.length) * 100)}%` }}
                  />
                </div>
              </div>

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
                          <MaterialIcon name="check_circle" size={18} className="text-[var(--color-accent)]" fill={1} />
                        )}
                        {isCurrent && (
                          <MaterialIcon name="sync" size={18} spin className="text-[var(--color-warning)]" />
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
                <MaterialIcon name="schedule" size={16} className="shrink-0 text-[var(--color-accent)]" />
                <span>You can close this drawer. Indexing will continue in the background.</span>
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
            <div role="status" aria-label="Repository indexed and ready" className="space-y-6 px-4 mt-6 text-center">
              <div className="h-12 w-12 rounded-full bg-[var(--color-accent-tint)] border border-[var(--color-accent-border)] flex items-center justify-center text-[var(--color-accent)] mx-auto">
                <MaterialIcon name="check_circle" size={28} aria-hidden="true" fill={1} />
              </div>

              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--color-accent-tint)] border border-[var(--color-accent-border)] text-xs font-medium text-[var(--color-accent)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" aria-hidden="true" />
                  <span>Ready</span>
                </div>
                <h3 className="text-base font-semibold text-[var(--color-text)]">
                  Repository ready
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto leading-relaxed">
                  Your repository is indexed and ready for AI search, architecture exploration, and grounded Q&A.
                </p>
              </div>

              <div className="pt-4">
                <Button
                  className="w-full"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/repositories/${connectedRepo.id}`);
                  }}
                  aria-label="Open indexed repository"
                >
                  <span>Open repository</span>
                  <MaterialIcon name="arrow_forward" size={16} aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Failed State (connect_ready_failed.png - Failed view) */}
          {step === 'failed' && (
            <div role="alert" aria-live="assertive" className="space-y-5 px-4 mt-6 text-center">
              <div className="h-12 w-12 rounded-full bg-[var(--color-error-tint)] border border-[var(--color-error-border)] flex items-center justify-center text-[var(--color-error)] mx-auto">
                <MaterialIcon name="error" size={28} aria-hidden="true" />
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
                  <MaterialIcon name="restart_alt" size={16} />
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
