import { MaterialIcon } from '../ui/MaterialIcon';

interface ChatEmptyStateProps {
  repositoryName?: string;
  onSelectPrompt?: (prompt: string) => void;
}

export function ChatEmptyState({
  repositoryName = 'this repository',
}: ChatEmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto space-y-3">
      <div className="w-10 h-10 rounded-full bg-surface-overlay flex items-center justify-center text-accent">
        <MaterialIcon name="chat" size={20} />
      </div>

      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-text-primary">
          Ask about {repositoryName}
        </h2>
        <p className="text-xs text-text-secondary leading-relaxed">
          Questions are answered with verified code citations and line numbers directly from the repository index.
        </p>
      </div>
    </div>
  );
}
