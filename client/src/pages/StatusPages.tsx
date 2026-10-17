import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Clock,
  ShieldAlert,
  ServerOff,
  RotateCcw,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { GithubIcon } from '../components/ui/GithubIcon';
import { Button } from '../components/ui/button';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--color-page)] flex items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-5">
        <div className="h-16 w-16 rounded-2xl bg-[var(--color-raised)] border border-[var(--color-border-strong)] flex items-center justify-center text-[var(--color-accent)] mx-auto font-mono text-xl font-bold">
          404
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Page not found</h1>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            The page, repository, or conversation you are looking for does not exist or has been relocated.
          </p>
        </div>
        <div className="pt-2">
          <Button variant="primary" onClick={() => navigate('/dashboard')} className="gap-2">
            <ArrowLeft size={14} />
            <span>Return to Dashboard</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ServiceUnavailablePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--color-page)] flex items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-5">
        <div className="h-16 w-16 rounded-2xl bg-[var(--color-warning-tint)] border border-[rgba(251,191,36,0.3)] flex items-center justify-center text-[var(--color-warning)] mx-auto">
          <ServerOff size={28} />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-[var(--color-text)]">
            503 — Service Temporarily Unavailable
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            The Codebase Intellisense workers or pgvector instances are currently performing maintenance. Please retry in a few moments.
          </p>
        </div>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={() => navigate('/dashboard')}>
            <span>Dashboard</span>
          </Button>
          <Button variant="primary" onClick={() => window.location.reload()}>
            <RotateCcw size={14} />
            <span>Retry</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SigningInStatusPage() {
  const navigate = useNavigate();

  React.useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/dashboard');
    }, 1800);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[var(--color-page)] flex items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-5">
        <div className="h-16 w-16 rounded-2xl bg-[var(--color-raised)] border border-[var(--color-border-strong)] flex items-center justify-center text-[var(--color-accent)] mx-auto">
          <Loader2 size={28} className="animate-spin" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Signing you in</h1>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Authenticating your credentials with GitHub OAuth and verifying repository permissions...
          </p>
        </div>
      </div>
    </div>
  );
}

export function SignInFailedStatusPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--color-page)] flex items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-5">
        <div className="h-16 w-16 rounded-2xl bg-[var(--color-error-tint)] border border-[var(--color-error-border)] flex items-center justify-center text-[var(--color-error)] mx-auto">
          <AlertCircle size={28} />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Sign-in failed</h1>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            We could not complete your GitHub OAuth authorization. The session may have timed out or permissions were rejected.
          </p>
        </div>
        <div className="pt-2">
          <Button variant="primary" onClick={() => navigate('/status/signing-in')} className="gap-2">
            <GithubIcon size={15} />
            <span>Try Again</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AccessDeniedStatusPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--color-page)] flex items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-5">
        <div className="h-16 w-16 rounded-2xl bg-[var(--color-error-tint)] border border-[var(--color-error-border)] flex items-center justify-center text-[var(--color-error)] mx-auto">
          <ShieldAlert size={28} />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Access was denied</h1>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            You do not have permission to view or query this repository. Ensure your GitHub account has collaborator access.
          </p>
        </div>
        <div className="pt-2">
          <Button variant="secondary" onClick={() => navigate('/dashboard')} className="gap-2">
            <ArrowLeft size={14} />
            <span>Back to Dashboard</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SessionExpiredStatusPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--color-page)] flex items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-5">
        <div className="h-16 w-16 rounded-2xl bg-[var(--color-raised)] border border-[var(--color-border-strong)] flex items-center justify-center text-[var(--color-muted)] mx-auto">
          <Clock size={28} />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Your session expired</h1>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            For security, your authentication token has expired. Please sign in again with GitHub to continue.
          </p>
        </div>
        <div className="pt-2">
          <Button variant="primary" onClick={() => navigate('/status/signing-in')} className="gap-2">
            <GithubIcon size={15} />
            <span>Sign in again</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ServerUnreachableStatusPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--color-page)] flex items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-5">
        <div className="h-16 w-16 rounded-2xl bg-[var(--color-error-tint)] border border-[var(--color-error-border)] flex items-center justify-center text-[var(--color-error)] mx-auto">
          <ServerOff size={28} />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Can't reach the server</h1>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            Unable to connect to the backend server. Please verify your network connection or server status.
          </p>
        </div>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={() => navigate('/dashboard')}>
            Dashboard
          </Button>
          <Button variant="primary" onClick={() => window.location.reload()}>
            <RotateCcw size={14} />
            <span>Retry</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
