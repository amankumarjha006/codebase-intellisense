import * as React from 'react';
import { MaterialIcon } from './MaterialIcon';
import { Button } from './button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Keep errors visible in development console
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-[400px] flex items-center justify-center p-6"
        >
          <div className="max-w-md w-full rounded-[var(--radius-panel)] border border-[var(--color-error-border)] bg-[var(--color-surface)] p-6 text-center space-y-4 shadow-sm">
            <div
              className="h-12 w-12 rounded-full bg-[var(--color-error-tint)] border border-[var(--color-error-border)] flex items-center justify-center text-[var(--color-error)] mx-auto"
              aria-hidden="true"
            >
              <MaterialIcon name="error" size={24} fill={1} color="var(--color-error)" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                Something went wrong
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                An unexpected rendering error occurred while loading this view. You can retry or return to the dashboard.
              </p>
              {this.state.error?.message && (
                <div className="mt-2 p-2 rounded bg-[var(--color-raised)] text-[11px] font-mono text-[var(--color-error)] truncate">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={this.handleReset}
                className="gap-1.5"
              >
                <MaterialIcon name="refresh" size={16} aria-hidden="true" />
                <span>Retry</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/dashboard';
                }}
                className="gap-1.5"
              >
                <MaterialIcon name="dashboard" size={16} aria-hidden="true" />
                <span>Dashboard</span>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
