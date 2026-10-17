/**
 * Scenario state management for the interactive prototype.
 * Allows quick switching of UI states (e.g., empty dashboard, indexing repo, error states)
 * via a floating controls pill or URL parameters.
 */

export type DashboardScenario = 'populated' | 'empty' | 'loading' | 'error';
export type RepoScenario = 'ready' | 'indexing' | 'failed_with_fallback';
export type ChatScenario = 'normal' | 'streaming' | 'newer_version' | 'error_no_answer' | 'error_rate_limit';
export type ArchitectureScenario = 'completed' | 'generating' | 'empty';

export interface PrototypeScenarios {
  dashboard: DashboardScenario;
  repo: RepoScenario;
  chat: ChatScenario;
  architecture: ArchitectureScenario;
}

const STORAGE_KEY = 'codebase_intellisense_scenarios';

const defaultScenarios: PrototypeScenarios = {
  dashboard: 'populated',
  repo: 'ready',
  chat: 'normal',
  architecture: 'completed',
};

export function getStoredScenarios(): PrototypeScenarios {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultScenarios;
    return { ...defaultScenarios, ...JSON.parse(raw) };
  } catch {
    return defaultScenarios;
  }
}

export function saveStoredScenarios(scenarios: PrototypeScenarios): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
    window.dispatchEvent(new CustomEvent('scenario-change', { detail: scenarios }));
  } catch {
    // Ignore storage errors in sandbox
  }
}
