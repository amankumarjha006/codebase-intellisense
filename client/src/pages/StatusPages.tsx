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
import { AnimatedPage } from '../components/ui/AnimatedPage';
import { useAuth } from '../lib/AuthContext';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <AnimatedPage className="min-h-screen bg-[var(--color-page)] flex items-center justify-center p-6 text-center">
      <main id="main-content" role="main" className="max-w-md space-y-5">
        <div
          className="h-16 w-16 rounded-2xl bg-[var(--color-raised)] border border-[var(--color-border-strong)] flex items-center justify-center text-[var(--color-accent)] mx-auto font-mono text-xl font-bold"
          aria-hidden="true"
        >
          404
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Page not found</h1>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            The page, repository, or conversation you are looking for does not exist or has been relocated.
          </p>
        </div>
        <div className="pt-2">
          <Button
            variant="primary"
            onClick={() => navigate('/dashboard')}
            className="gap-2"
            aria-label="Return to Dashboard"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Return to Dashboard</span>
          </Button>
        </div>
      </main>
    </AnimatedPage>
  );
}

export function ServiceUnavailablePage() {
  const navigate = useNavigate();

  return (
    <AnimatedPage className="min-h-screen bg-[var(--color-page)] flex items-center justify-center p-6 text-center">
      <main id="main-content" role="alert" aria-live="assertive" className="max-w-md space-y-5">
        <div
          className="h-16 w-16 rounded-2xl bg-[var(--color-warning-tint)] border border-[rgba(251,191,36,0.3)] flex items-center justify-center text-[var(--color-warning)] mx-auto"
          aria-hidden="true"
        >
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
          <Button
            variant="secondary"
            onClick={() => navigate('/dashboard')}
            aria-label="Go to Dashboard"
          >
            <span>Dashboard</span>
          </Button>
          <Button
            variant="primary"
            onClick={() => window.location.reload()}
            aria-label="Retry loading page"
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>Retry</span>
          </Button>
        </div>
      </main>
    </AnimatedPage>
  );
}

export function SigningInStatusPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  React.useEffect(() => {
    let active = true;
    refreshUser().then((currentUser) => {
      if (!active) return;
      if (currentUser) {
        navigate('/dashboard', { replace: true });
      } else {
        const timer = setTimeout(() => {
          if (active) {
            navigate('/status/sign-in-failed', { replace: true });
          }
        }, 2200);
        return () => clearTimeout(timer);
      }
    });

    return () => {
      active = false;
    };
  }, [refreshUser, navigate]);

  return (
    <AnimatedPage className="min-h-screen bg-[var(--color-page)] flex items-center justify-center p-6 text-center">
      <main id="main-content" role="status" aria-live="polite" className="max-w-md space-y-5">
        <div
          className="h-16 w-16 rounded-2xl bg-[var(--color-raised)] border border-[var(--color-border-strong)] flex items-center justify-center text-[var(--color-accent)] mx-auto"
          aria-hidden="true"
        >
          <Loader2 size={28} className="animate-spin" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Signing you in</h1>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            Authenticating your credentials with GitHub OAuth and verifying repository permissions...
          </p>
        </div>
      </main>
    </AnimatedPage>
  );
}

export function SignInFailedStatusPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  return (
    <AnimatedPage className="min-h-screen bg-[var(--color-page)] flex items-center justify-center p-6 text-center">
      <main id="main-content" role="alert" aria-live="assertive" className="max-w-md space-y-5">
        <div
          className="h-16 w-16 rounded-2xl bg-[var(--color-error-tint)] border border-[var(--color-error-border)] flex items-center justify-center text-[var(--color-error)] mx-auto"
          aria-hidden="true"
        >
          <AlertCircle size={28} />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Sign-in failed</h1>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            We could not complete your GitHub OAuth authorization. The session may have timed out or permissions were rejected.
          </p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <Button
            variant="primary"
            onClick={signIn}
            className="gap-2 w-full sm:w-auto"
            aria-label="Try signing in again with GitHub"
          >
            <GithubIcon size={15} aria-hidden="true" />
            <span>Try Again</span>
          </Button>

          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="gap-2 w-full sm:w-auto text-xs"
            aria-label="Back to home page"
          >
            <span>Back to Home</span>
          </Button>
        </div>
      </main>
    </AnimatedPage>
  );
}

export function AccessDeniedStatusPage() {
  const navigate = useNavigate();

  return (
    <AnimatedPage className="min-h-screen bg-[var(--color-page)] flex items-center justify-center p-6 text-center">
      <main id="main-content" role="alert" aria-live="assertive" className="max-w-md space-y-5">
        <div
          className="h-16 w-16 rounded-2xl bg-[var(--color-error-tint)] border border-[var(--color-error-border)] flex items-center justify-center text-[var(--color-error)] mx-auto"
          aria-hidden="true"
        >
          <ShieldAlert size={28} />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Access was denied</h1>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            You do not have permission to view or query this repository. Ensure your GitHub account has collaborator access.
          </p>
        </div>
        <div className="pt-2">
          <Button
            variant="secondary"
            onClick={() => navigate('/dashboard')}
            className="gap-2"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Back to Dashboard</span>
          </Button>
        </div>
      </main>
    </AnimatedPage>
  );
}

export function SessionExpiredStatusPage() {
  const navigate = useNavigate();
  const { user, signIn } = useAuth();

  React.useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  return (
    <AnimatedPage className="min-h-screen bg-[var(--color-page)] flex items-center justify-center p-6 text-center">
      <main id="main-content" role="alert" aria-live="assertive" className="max-w-md space-y-5">
        <div
          className="h-16 w-16 rounded-2xl bg-[var(--color-raised)] border border-[var(--color-border-strong)] flex items-center justify-center text-[var(--color-muted)] mx-auto"
          aria-hidden="true"
        >
          <Clock size={28} />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Your session expired</h1>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            For security, your authentication token has expired. Please sign in again with GitHub to continue.
          </p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <Button
            variant="primary"
            onClick={signIn}
            className="gap-2 w-full sm:w-auto"
            aria-label="Sign in again with GitHub"
          >
            <GithubIcon size={15} aria-hidden="true" />
            <span>Sign in with GitHub</span>
          </Button>

          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="gap-2 w-full sm:w-auto text-xs"
            aria-label="Back to home page"
          >
            <span>Back to Home</span>
          </Button>
        </div>
      </main>
    </AnimatedPage>
  );
}

export function ServerUnreachableStatusPage() {
  const navigate = useNavigate();

  return (
    <AnimatedPage className="min-h-screen bg-[var(--color-page)] flex items-center justify-center p-6 text-center">
      <main id="main-content" role="alert" aria-live="assertive" className="max-w-md space-y-5">
        <div
          className="h-16 w-16 rounded-2xl bg-[var(--color-error-tint)] border border-[var(--color-error-border)] flex items-center justify-center text-[var(--color-error)] mx-auto"
          aria-hidden="true"
        >
          <ServerOff size={28} />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Can't reach the server</h1>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            Unable to connect to the backend server. Please verify your network connection or server status.
          </p>
        </div>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate('/dashboard')}
            aria-label="Go to Dashboard"
          >
            Dashboard
          </Button>
          <Button
            variant="primary"
            onClick={() => window.location.reload()}
            aria-label="Retry connection"
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>Retry</span>
          </Button>
        </div>
      </main>
    </AnimatedPage>
  );
}
