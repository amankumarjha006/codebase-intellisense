import { MaterialIcon } from '../ui/MaterialIcon';
import { Repository } from '../../lib/types';
import { Card } from '../ui/card';

interface RepoSuggestion {
  question: string;
  file_hint: string;
  category: string;
}

export function buildRepoSuggestions(repoName: string, files: string[] = []): RepoSuggestion[] {
  if (!files || files.length === 0) {
    return [
      {
        question: `What is the architecture and folder structure of ${repoName}?`,
        file_hint: `${repoName} structure`,
        category: 'Architecture',
      },
      {
        question: `What are the core features and primary entry points?`,
        file_hint: `Entry points`,
        category: 'Overview',
      },
      {
        question: `How does data and logic flow across this codebase?`,
        file_hint: `Data flow`,
        category: 'Logic',
      },
      {
        question: `What are the prerequisites and setup steps to run ${repoName}?`,
        file_hint: `Setup & build`,
        category: 'Configuration',
      },
    ];
  }

  const suggestions: RepoSuggestion[] = [];

  // 1. Entry point / Application initialization
  const entryFile = files.find((p) =>
    /^(src\/)?(App|main|index)\.(jsx?|tsx?|vue|py|go|rs|js|ts)$/i.test(p) ||
    /^(main\.py|app\.py|index\.html|server\.js|app\.js)$/i.test(p)
  );
  if (entryFile) {
    const fileName = entryFile.split('/').pop()!;
    suggestions.push({
      question: `How does the application initialize and bootstrap in ${fileName}?`,
      file_hint: entryFile,
      category: 'Entry Point',
    });
  } else {
    suggestions.push({
      question: `What is the entry point and primary architecture of ${repoName}?`,
      file_hint: files[0] || `${repoName} entry`,
      category: 'Architecture',
    });
  }

  // 2. Pages / Routes / Views / Components
  const routeOrComponent = files.find((p) =>
    /(pages|routes|views|screens|components)\/.*\.(jsx?|tsx?|vue|py|html)$/i.test(p)
  );
  if (routeOrComponent) {
    const targetName = routeOrComponent.split('/').pop()!;
    suggestions.push({
      question: `What are the main UI components and navigation flows around ${targetName}?`,
      file_hint: routeOrComponent,
      category: 'Components',
    });
  } else {
    suggestions.push({
      question: `What are the core functional modules in ${repoName}?`,
      file_hint: `${repoName} modules`,
      category: 'Modules',
    });
  }

  // 3. Data / Models / State / API
  const dataOrApi = files.find((p) =>
    /(data|api|services|models|store|state|utils)\/.*\.(jsx?|tsx?|py|js|ts|json)$/i.test(p) &&
    !p.includes('package')
  );
  if (dataOrApi) {
    const dataName = dataOrApi.split('/').pop()!;
    suggestions.push({
      question: `How is data structured, fetched, and validated in ${dataName}?`,
      file_hint: dataOrApi,
      category: 'Data & Services',
    });
  } else {
    suggestions.push({
      question: `How is state and business logic handled across this project?`,
      file_hint: `Logic & State`,
      category: 'State Management',
    });
  }

  // 4. Dependencies / Configuration / Build
  const configFile = files.find((p) =>
    /^(package\.json|vite\.config\.[jt]s|requirements\.txt|pyproject\.toml|Cargo\.toml|go\.mod|webpack\.config\.js|tailwind\.config\.[jt]s)$/i.test(p)
  );
  if (configFile) {
    suggestions.push({
      question: `What dependencies, scripts, and build tools are defined in ${configFile}?`,
      file_hint: configFile,
      category: 'Configuration',
    });
  } else {
    suggestions.push({
      question: `How is this repository configured, built, and tested?`,
      file_hint: `Configuration`,
      category: 'Build',
    });
  }

  return suggestions;
}

interface ChatEmptyStateProps {
  repository: Repository;
  repoFiles: string[];
  onSelectSuggestion: (question: string) => void;
}

export function ChatEmptyState({
  repository,
  repoFiles,
  onSelectSuggestion,
}: ChatEmptyStateProps) {
  const suggestions = buildRepoSuggestions(repository.name, repoFiles);

  return (
    <section
      aria-label="Repository inquiry suggestions"
      className="max-w-3xl mx-auto py-10 px-4 text-center space-y-6 select-none"
    >
      <div
        className="h-12 w-12 rounded-xl bg-[var(--color-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-mint-accent,#B9E4D0)] mx-auto shadow-sm"
        aria-hidden="true"
      >
        <MaterialIcon name="terminal" size={26} fill={1} color="var(--color-mint-accent, #B9E4D0)" />
      </div>

      <div>
        <h2 className="text-lg sm:text-xl font-bold text-[var(--color-text)] tracking-tight">
          Ask anything about <span className="text-[var(--color-mint-accent,#B9E4D0)]">{repository.name}</span>
        </h2>
        <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-1.5 max-w-lg mx-auto leading-relaxed">
          Grounded codebase intelligence with verified source citations and direct code navigation.
        </p>
      </div>

      {/* Suggested Questions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
        {suggestions.map((sq, i) => (
          <Card
            key={i}
            onClick={() => onSelectSuggestion(sq.question)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectSuggestion(sq.question);
              }
            }}
            className="p-3.5 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-mint-accent,#B9E4D0)] hover:bg-[var(--color-raised)]/60 transition cursor-pointer text-xs space-y-2 group"
          >
            <div className="flex items-center justify-between text-[10px] font-mono text-[var(--color-muted)]">
              <span className="uppercase tracking-wider text-[var(--color-mint-accent,#B9E4D0)] font-semibold">
                {sq.category}
              </span>
              <MaterialIcon name="arrow_forward" size={14} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-[var(--color-mint-accent,#B9E4D0)]" aria-hidden="true" />
            </div>

            <div className="font-medium text-[var(--color-text)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition-colors leading-snug">
              {sq.question}
            </div>

            {sq.file_hint && (
              <div className="text-[11px] font-mono text-[var(--color-muted)] truncate flex items-center gap-1.5 pt-1 border-t border-[var(--color-border)]/40">
                <MaterialIcon name="code" size={13} className="shrink-0 text-[var(--color-mint-accent,#B9E4D0)]" aria-hidden="true" />
                <span className="truncate">{sq.file_hint}</span>
              </div>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
}
