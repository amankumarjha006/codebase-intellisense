import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../ui/MaterialIcon';
import { Button } from '../ui/button';
import { StatusDot } from '../ui/StatusDot';
import { getRepositoryStatusCategory } from '../../lib/repositoryTableUtils';
import type { RepositoryListItemOut, ConversationOut } from '../../lib/api';

interface ContinueHeroProps {
  repository: RepositoryListItemOut | null;
  lastConversation?: ConversationOut | null;
}

export function ContinueHero({ repository, lastConversation }: ContinueHeroProps) {
  const navigate = useNavigate();

  if (!repository) return null;

  const category = getRepositoryStatusCategory(repository);
  const convTitle = lastConversation?.title || 'Start a conversation';
  const chatUrl = lastConversation
    ? `/repositories/${repository.id}/chat?conversationId=${lastConversation.id}`
    : `/repositories/${repository.id}/chat`;

  return (
    <div className="rounded-lg border border-white/10 bg-surface-raised p-5 relative overflow-hidden transition-all hover:border-white/15">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
              Continue
            </span>
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <StatusDot
                status={
                  category === 'INDEXING'
                    ? 'indexing'
                    : category === 'FAILED'
                    ? 'failed'
                    : 'ready'
                }
              />
              <span className="font-medium text-text-primary">
                {repository.owner}/{repository.name}
              </span>
              {repository.is_private && (
                <MaterialIcon name="lock" size={13} className="text-text-tertiary" />
              )}
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-semibold text-text-primary truncate">
              {convTitle}
            </h2>
            <p className="text-xs text-text-secondary line-clamp-1">
              Ask questions grounded in codebase citations, inspect architecture diagrams, or search symbols.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/repositories/${repository.id}`)}
            className="h-8 text-xs text-text-secondary hover:text-text-primary border border-white/10"
          >
            Open overview
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(chatUrl)}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <MaterialIcon name="chat" size={15} />
            Resume chat
          </Button>
        </div>
      </div>
    </div>
  );
}

