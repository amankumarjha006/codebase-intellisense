import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../ui/MaterialIcon';
import { formatRelativeTime } from '../../lib/utils';

export interface RecentConversationItem {
  id: string;
  repoId: string;
  repoName: string;
  title: string;
  updatedAt: string;
}

interface RecentConversationsListProps {
  conversations: RecentConversationItem[];
  loading?: boolean;
}

export function RecentConversationsList({
  conversations,
  loading = false,
}: RecentConversationsListProps) {
  const navigate = useNavigate();

  if (!loading && conversations.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          Recent Conversations
        </h3>
        <span className="text-xs text-text-tertiary tabular-nums font-mono">
          {conversations.length}
        </span>
      </div>

      <div className="rounded-lg border border-white/10 bg-surface-raised divide-y divide-white/5 overflow-hidden">
        {loading ? (
          <div className="p-4 text-xs text-text-tertiary text-center">
            Loading conversations...
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() =>
                navigate(`/repositories/${conv.repoId}/chat?conversationId=${conv.id}`)
              }
              className="group p-3 flex items-center justify-between gap-3 hover:bg-surface-overlay/60 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <MaterialIcon
                  name="chat_bubble_outline"
                  size={15}
                  className="text-text-tertiary group-hover:text-accent shrink-0 transition-colors"
                />
                <span className="text-xs font-medium text-text-primary truncate">
                  {conv.title}
                </span>
                <span className="text-[11px] text-text-tertiary bg-surface-overlay px-1.5 py-0.5 rounded shrink-0">
                  {conv.repoName}
                </span>
              </div>

              <span className="text-[11px] text-text-tertiary tabular-nums shrink-0">
                {formatRelativeTime(conv.updatedAt)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

