import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { GithubIcon } from '../components/ui/GithubIcon';
import { Button } from '../components/ui/button';
import { AnimatedPage } from '../components/ui/AnimatedPage';
import { useAuth } from '../lib/AuthContext';
import { API_URL } from '../lib/api';

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
            <MaterialIcon name="arrow_back" size={16} aria-hidden="true" />
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
          <MaterialIcon name="cloud_off" size={32} />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-[var(--color-text)]">
            503 — Service Temporarily Unavailable
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            The service is currently undergoing brief maintenance. Please retry in a few moments.
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
            <MaterialIcon name="restart_alt" size={16} aria-hidden="true" />
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
          <MaterialIcon name="sync" size={32} spin />
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
          <MaterialIcon name="error" size={32} />
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
          <MaterialIcon name="security" size={32} />
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
            <MaterialIcon name="arrow_back" size={16} aria-hidden="true" />
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
          <MaterialIcon name="schedule" size={32} />
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
  const [testingConnection, setTestingConnection] = React.useState(false);
  const [pingResult, setPingResult] = React.useState<string | null>(null);

  const handleCheckConnection = async () => {
    setTestingConnection(true);
    setPingResult(null);
    try {
      const res = await fetch(`${API_URL}/auth/me`, { method: 'GET' });
      if (res.ok || res.status === 401) {
        setPingResult('Backend is reachable! Reloading...');
        setTimeout(() => window.location.reload(), 700);
      } else {
        setPingResult(`HTTP ${res.status}: Server returned unexpected status.`);
      }
    } catch {
      setPingResult('Connection refused. Verify your FastAPI server is running on port 8000.');
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <AnimatedPage className="min-h-screen bg-[var(--color-page)] flex items-center justify-center p-6 text-center">
      <main id="main-content" role="alert" aria-live="assertive" className="max-w-md w-full space-y-5">
        <div
          className="h-16 w-16 rounded-2xl bg-[var(--color-error-tint)] border border-[var(--color-error-border)] flex items-center justify-center text-[var(--color-error)] mx-auto"
          aria-hidden="true"
        >
          <MaterialIcon name="cloud_off" size={32} />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Can't reach the server</h1>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            Unable to connect to the backend server. Please verify your network connection or server status.
          </p>
        </div>

        {/* Diagnostic Panel */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 text-left font-mono text-[11px] space-y-2">
          <div className="flex items-center justify-between text-[var(--color-muted)]">
            <span>Target API:</span>
            <span className="text-[var(--color-text)] truncate max-w-[240px]">{API_URL}</span>
          </div>
          {pingResult && (
            <div className={`pt-1 border-t border-[var(--color-border)]/50 text-[11px] leading-relaxed ${pingResult.includes('reachable') ? 'text-[var(--color-mint-accent,#B9E4D0)]' : 'text-[var(--color-error)]'}`}>
              {pingResult}
            </div>
          )}
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
            onClick={handleCheckConnection}
            disabled={testingConnection}
            aria-label="Check server connection"
            className="gap-1.5"
          >
            <MaterialIcon name="sync" size={16} spin={testingConnection} aria-hidden="true" />
            <span>{testingConnection ? 'Testing...' : 'Check Connection'}</span>
          </Button>
        </div>
      </main>
    </AnimatedPage>
  );
}
