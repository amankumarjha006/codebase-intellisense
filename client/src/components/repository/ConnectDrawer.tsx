import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitBranch,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { GithubIcon } from '../ui/GithubIcon';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '../ui/drawer';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { api } from '../../lib/api';
import { JobStatus, RepositoryListItem } from '../../lib/types';
import { sleep } from '../../lib/utils';

interface ConnectDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ConnectStep = 'input' | 'configure' | 'indexing' | 'success' | 'failed';

export function ConnectDrawer({ open, onOpenChange }: ConnectDrawerProps) {
  const navigate = useNavigate();
  const [step, setStep] = React.useState<ConnectStep>('input');
  const [repoUrl, setRepoUrl] = React.useState('');
  const [branch, setBranch] = React.useState('main');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Indexing progress state
  const [connectedRepo, setConnectedRepo] = React.useState<RepositoryListItem | null>(null);
  const [progressPercent, setProgressPercent] = React.useState(0);
  const [currentPhase, setCurrentPhase] = React.useState('Queued in worker pipeline');
  const [currentFile, setCurrentFile] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      // Reset state after drawer closes
      const timer = setTimeout(() => {
        setStep('input');
        setRepoUrl('');
        setErrorMsg(null);
        setConnectedRepo(null);
        setProgressPercent(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) {
      setErrorMsg('Please enter a GitHub repository URL');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.connectRepository(repoUrl.trim());
      setConnectedRepo(res.repository);
      setStep('configure');
    } catch (err: any) {
      if (err.message) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to connect repository. Please verify the URL and your access.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartIndexing = async () => {
    if (!connectedRepo) return;
    setStep('indexing');
    setProgressPercent(10);
    setCurrentPhase('Cloning repository files...');

    // Simulate progressive indexing stages
    try {
      await sleep(700);
      setProgressPercent(28);
      setCurrentPhase('Parsing files with Tree-sitter AST parser');
      setCurrentFile('server/app/main.py');

      await sleep(800);
      setProgressPercent(54);
      setCurrentPhase('Extracting hierarchical symbols & building chunks');
      setCurrentFile('server/app/services/indexing/ast_chunker.py');

      await sleep(900);
      setProgressPercent(78);
      setCurrentPhase('Generating dense vector embeddings with Gemini');
      setCurrentFile('server/app/services/retrieval/hybrid.py');

      await sleep(800);
      setProgressPercent(100);
      setCurrentPhase('Writing indexes to pgvector');

      await sleep(500);
      connectedRepo.latest_job_status = 'READY';
      setStep('success');
    } catch {
      setStep('failed');
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right" className="flex flex-col justify-between">
        <div>
          <DrawerHeader>
            <DrawerTitle>Connect repository</DrawerTitle>
            <DrawerDescription>
              Link a GitHub repository to index its abstract syntax tree, generate vector embeddings, and enable grounded code Q&A.
            </DrawerDescription>
          </DrawerHeader>

          {/* Step 1: Input GitHub URL */}
          {step === 'input' && (
            <form onSubmit={handleConnectSubmit} className="space-y-4 mt-2">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text)] mb-1.5">
                  GitHub Repository URL
                </label>
                <div className="relative">
                  <Input
                    value={repoUrl}
                    onChange={(e) => {
                      setRepoUrl(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="https://github.com/owner/repository"
                    error={!!errorMsg}
                    className="font-mono text-xs pl-8"
                    autoFocus
                  />
                  <GithubIcon size={15} className="absolute left-2.5 top-2.5 text-[var(--color-muted)]" />
                </div>

                {errorMsg ? (
                  <p className="mt-2 text-xs text-[var(--color-error)] flex items-center gap-1.5 animate-in fade-in">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-[var(--color-muted)]">
                    Supports public and authorized private repositories.
                  </p>
                )}
              </div>

              {/* Sample quick picks */}
              <div className="pt-2">
                <span className="text-[11px] font-medium text-[var(--color-muted)] block mb-1.5">
                  Try with an example:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRepoUrl('https://github.com/facebook/react')}
                    className="px-2 py-1 rounded bg-[var(--color-raised)] text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
                  >
                    facebook/react
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepoUrl('https://github.com/astral-sh/uv')}
                    className="px-2 py-1 rounded bg-[var(--color-raised)] text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
                  >
                    astral-sh/uv
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepoUrl('https://github.com/ratelimit/test')}
                    className="px-2 py-1 rounded bg-[var(--color-raised)] text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
                  >
                    (Simulate error)
                  </button>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Verifying repository...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Step 2: Configure & Index Options */}
          {step === 'configure' && connectedRepo && (
            <div className="space-y-4 mt-2">
              <div className="p-3 rounded-[var(--radius-control)] bg-[var(--color-raised)] border border-[var(--color-border)]">
                <div className="text-xs text-[var(--color-muted)]">Repository identified:</div>
                <div className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-1.5 mt-0.5">
                  <GitBranch size={14} className="text-[var(--color-accent)]" />
                  <span>{connectedRepo.owner}/{connectedRepo.name}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text)] mb-1.5">
                  Default Branch
                </label>
                <Input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="p-3 rounded-[var(--radius-control)] bg-[var(--color-raised)]/50 border border-[var(--color-border)] text-xs space-y-2">
                <div className="font-semibold text-[var(--color-text)]">Indexing Scope & Engine</div>
                <ul className="space-y-1 text-[var(--color-text-secondary)] list-disc list-inside text-[11px]">
                  <li>Tree-sitter concrete syntax tree parser</li>
                  <li>Hierarchical parent-child chunk boundary mapping</li>
                  <li>PostgreSQL + pgvector dense cosine index</li>
                  <li>Full-text sparse keyword index for exact symbols</li>
                </ul>
              </div>

              <div className="pt-4 flex gap-2">
                <Button variant="secondary" onClick={() => setStep('input')} className="w-1/3">
                  Back
                </Button>
                <Button onClick={handleStartIndexing} className="w-2/3">
                  Start Indexing
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Indexing Progress */}
          {step === 'indexing' && (
            <div className="space-y-5 mt-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-[var(--color-text)]">{currentPhase}</span>
                  <span className="font-mono text-[var(--color-accent)] font-semibold">{progressPercent}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[var(--color-raised)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-accent)] transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {currentFile && (
                  <div className="text-[11px] font-mono text-[var(--color-muted)] truncate">
                    Processing: {currentFile}
                  </div>
                )}
              </div>

              {/* Progress Milestones */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3 text-xs">
                  <CheckCircle2 size={16} className="text-[var(--color-accent)] shrink-0" />
                  <span className="text-[var(--color-text)]">Repository cloned and verified</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {progressPercent >= 50 ? (
                    <CheckCircle2 size={16} className="text-[var(--color-accent)] shrink-0" />
                  ) : (
                    <Loader2 size={16} className="animate-spin text-[var(--color-warning)] shrink-0" />
                  )}
                  <span className={progressPercent >= 50 ? 'text-[var(--color-text)]' : 'text-[var(--color-muted)]'}>
                    Tree-sitter AST parsed into symbols
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {progressPercent >= 80 ? (
                    <CheckCircle2 size={16} className="text-[var(--color-accent)] shrink-0" />
                  ) : progressPercent >= 50 ? (
                    <Loader2 size={16} className="animate-spin text-[var(--color-warning)] shrink-0" />
                  ) : (
                    <Clock size={16} className="text-[var(--color-muted)] shrink-0" />
                  )}
                  <span className={progressPercent >= 80 ? 'text-[var(--color-text)]' : 'text-[var(--color-muted)]'}>
                    Gemini dense embeddings generated
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {progressPercent === 100 ? (
                    <CheckCircle2 size={16} className="text-[var(--color-accent)] shrink-0" />
                  ) : (
                    <Clock size={16} className="text-[var(--color-muted)] shrink-0" />
                  )}
                  <span className={progressPercent === 100 ? 'text-[var(--color-text)]' : 'text-[var(--color-muted)]'}>
                    pgvector index synchronized
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 'success' && connectedRepo && (
            <div className="space-y-4 mt-6 text-center">
              <div className="h-12 w-12 rounded-full bg-[var(--color-accent-tint)] border border-[var(--color-accent-border)] flex items-center justify-center text-[var(--color-accent)] mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text)]">
                  Indexing complete!
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  {connectedRepo.owner}/{connectedRepo.name} is ready for grounded semantic questions and architecture visualization.
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
                  <span>Go to repository</span>
                  <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Failed */}
          {step === 'failed' && (
            <div className="space-y-4 mt-6 text-center">
              <div className="h-12 w-12 rounded-full bg-[var(--color-error-tint)] border border-[var(--color-error-border)] flex items-center justify-center text-[var(--color-error)] mx-auto">
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text)]">
                  Indexing failed
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  An error occurred while communicating with the embedding worker. Please retry.
                </p>
              </div>

              <div className="pt-4 flex gap-2">
                <Button variant="secondary" onClick={() => onOpenChange(false)} className="w-1/2">
                  Close
                </Button>
                <Button onClick={handleStartIndexing} className="w-1/2">
                  Retry
                </Button>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
