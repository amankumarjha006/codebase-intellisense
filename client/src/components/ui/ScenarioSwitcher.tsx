import * as React from 'react';
import { Settings2, X, RotateCcw } from 'lucide-react';
import {
  getStoredScenarios,
  saveStoredScenarios,
  PrototypeScenarios,
  DashboardScenario,
  RepoScenario,
  ChatScenario,
  ArchitectureScenario,
} from '../../lib/scenarios';
import { isMockEnabled } from '../../lib/api';

export function ScenarioSwitcher() {
  const [open, setOpen] = React.useState(false);
  const [scenarios, setScenarios] = React.useState<PrototypeScenarios>(getStoredScenarios);

  if (!isMockEnabled) {
    return null;
  }

  const updateScenario = <K extends keyof PrototypeScenarios>(
    key: K,
    value: PrototypeScenarios[K]
  ) => {
    const next = { ...scenarios, [key]: value };
    setScenarios(next);
    saveStoredScenarios(next);
  };

  const resetAll = () => {
    const defaults: PrototypeScenarios = {
      dashboard: 'populated',
      repo: 'ready',
      chat: 'normal',
      architecture: 'completed',
    };
    setScenarios(defaults);
    saveStoredScenarios(defaults);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[999] font-sans">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-raised)]/90 backdrop-blur-md px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] shadow-xl hover:text-[var(--color-text)] hover:border-[var(--color-accent)] transition-all"
          title="Switch Prototype UI Scenarios"
        >
          <Settings2 size={13} className="text-[var(--color-accent)]" />
          <span>Prototype Scenarios</span>
        </button>
      ) : (
        <div className="w-80 rounded-[var(--radius-panel)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)] mb-3">
            <div className="flex items-center gap-1.5">
              <Settings2 size={14} className="text-[var(--color-accent)]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text)]">
                Scenario Switcher
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={resetAll}
                className="p-1 text-[var(--color-muted)] hover:text-[var(--color-text)] transition rounded"
                title="Reset to defaults"
              >
                <RotateCcw size={12} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-[var(--color-muted)] hover:text-[var(--color-text)] transition rounded"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            {/* Dashboard States */}
            <div>
              <label className="text-[var(--color-muted)] block mb-1 font-medium">Dashboard State</label>
              <div className="grid grid-cols-2 gap-1">
                {(['populated', 'empty', 'loading', 'error'] as DashboardScenario[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => updateScenario('dashboard', st)}
                    className={`px-2 py-1 rounded text-left capitalize transition border ${
                      scenarios.dashboard === st
                        ? 'bg-[var(--color-accent-tint)] border-[var(--color-accent)] text-[var(--color-accent)] font-medium'
                        : 'border-[var(--color-border)] bg-[var(--color-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-raised)]/80'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Repo Overview State */}
            <div>
              <label className="text-[var(--color-muted)] block mb-1 font-medium">Repo Overview State</label>
              <div className="grid grid-cols-2 gap-1">
                {(['ready', 'indexing', 'failed_with_fallback'] as RepoScenario[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => updateScenario('repo', st)}
                    className={`px-2 py-1 rounded text-left capitalize transition border truncate ${
                      scenarios.repo === st
                        ? 'bg-[var(--color-accent-tint)] border-[var(--color-accent)] text-[var(--color-accent)] font-medium'
                        : 'border-[var(--color-border)] bg-[var(--color-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-raised)]/80'
                    }`}
                  >
                    {st.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Response State */}
            <div>
              <label className="text-[var(--color-muted)] block mb-1 font-medium">Chat State</label>
              <div className="grid grid-cols-2 gap-1">
                {(['normal', 'newer_version', 'error_no_answer', 'error_rate_limit'] as ChatScenario[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => updateScenario('chat', st)}
                    className={`px-2 py-1 rounded text-left capitalize transition border truncate ${
                      scenarios.chat === st
                        ? 'bg-[var(--color-accent-tint)] border-[var(--color-accent)] text-[var(--color-accent)] font-medium'
                        : 'border-[var(--color-border)] bg-[var(--color-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-raised)]/80'
                    }`}
                  >
                    {st.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Architecture State */}
            <div>
              <label className="text-[var(--color-muted)] block mb-1 font-medium">Architecture State</label>
              <div className="grid grid-cols-3 gap-1">
                {(['completed', 'generating', 'empty'] as ArchitectureScenario[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => updateScenario('architecture', st)}
                    className={`px-2 py-1 rounded text-left capitalize transition border truncate ${
                      scenarios.architecture === st
                        ? 'bg-[var(--color-accent-tint)] border-[var(--color-accent)] text-[var(--color-accent)] font-medium'
                        : 'border-[var(--color-border)] bg-[var(--color-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-raised)]/80'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Status Page Links */}
            <div className="pt-2 border-t border-[var(--color-border)]">
              <label className="text-[var(--color-muted)] block mb-1 font-medium">Quick Status Previews</label>
              <div className="flex flex-wrap gap-1">
                <a href="/status/signing-in" className="px-1.5 py-0.5 rounded bg-[var(--color-raised)] text-[10px] text-[var(--color-muted)] hover:text-[var(--color-text)]">
                  Signing in
                </a>
                <a href="/status/sign-in-failed" className="px-1.5 py-0.5 rounded bg-[var(--color-raised)] text-[10px] text-[var(--color-muted)] hover:text-[var(--color-text)]">
                  Sign-in failed
                </a>
                <a href="/status/access-denied" className="px-1.5 py-0.5 rounded bg-[var(--color-raised)] text-[10px] text-[var(--color-muted)] hover:text-[var(--color-text)]">
                  Access denied
                </a>
                <a href="/status/session-expired" className="px-1.5 py-0.5 rounded bg-[var(--color-raised)] text-[10px] text-[var(--color-muted)] hover:text-[var(--color-text)]">
                  Session expired
                </a>
                <a href="/status/server-unreachable" className="px-1.5 py-0.5 rounded bg-[var(--color-raised)] text-[10px] text-[var(--color-muted)] hover:text-[var(--color-text)]">
                  Unreachable
                </a>
                <a href="/503" className="px-1.5 py-0.5 rounded bg-[var(--color-raised)] text-[10px] text-[var(--color-muted)] hover:text-[var(--color-text)]">
                  503
                </a>
                <a href="/404-test" className="px-1.5 py-0.5 rounded bg-[var(--color-raised)] text-[10px] text-[var(--color-muted)] hover:text-[var(--color-text)]">
                  404
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
