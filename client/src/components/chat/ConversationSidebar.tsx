import * as React from 'react';
import { MaterialIcon } from '../ui/MaterialIcon';
import { Conversation } from '../../lib/types';
import { formatRelativeTime } from '../../lib/utils';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeConvId: string | null;
  onSelectConv: (id: string) => void;
  onNewChat: () => void;
  onDeleteConv: (id: string) => void;
  loading?: boolean;
}

export function ConversationSidebar({
  conversations,
  activeConvId,
  onSelectConv,
  onNewChat,
  onDeleteConv,
  loading = false,
}: ConversationSidebarProps) {
  const [searchFilter, setSearchFilter] = React.useState('');

  const filteredConversations = conversations.filter((c) =>
    (c.title || '').toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <aside
      aria-label="Conversation history"
      className="w-72 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col shrink-0 hidden md:flex h-full select-none"
    >
      {/* Sidebar Header & New Question Action */}
      <div className="p-3 border-b border-[var(--color-border)] space-y-2.5">
        <Button
          size="sm"
          variant="primary"
          onClick={onNewChat}
          className="w-full justify-center gap-2 h-9 text-xs font-medium shadow-sm"
          aria-label="Start new conversation"
        >
          <MaterialIcon name="add" size={18} fill={1} aria-hidden="true" />
          <span>New Conversation</span>
        </Button>

        {conversations.length > 5 && (
          <div className="relative">
            <MaterialIcon
              name="search"
              size={15}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-2.5 py-1.5 rounded-[var(--radius-control)] bg-[var(--color-raised)] border border-[var(--color-border)] text-xs text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-mint-accent,#B9E4D0)] transition-colors"
            />
          </div>
        )}
      </div>

      {/* Conversations List */}
      <div
        role="listbox"
        aria-label="Saved conversations"
        className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar"
      >
        {loading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-[var(--radius-control)] bg-[var(--color-raised)] animate-pulse" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--color-muted)] space-y-2">
            <MaterialIcon name="chat_bubble_outline" size={24} className="mx-auto opacity-50" aria-hidden="true" />
            <p>No conversations yet. Ask a question to start exploring.</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-xs text-[var(--color-muted)]">
            No matching conversations found.
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const active = conv.id === activeConvId;
            return (
              <div
                key={conv.id}
                role="option"
                aria-selected={active}
                onClick={() => onSelectConv(conv.id)}
                className={`group relative w-full flex items-start gap-2.5 p-2.5 rounded-[var(--radius-control)] text-left text-xs transition cursor-pointer ${
                  active
                    ? 'bg-[var(--color-mint-selected-bg,#253A32)] text-[var(--color-mint-accent,#B9E4D0)] border border-[rgba(185,228,208,0.25)] shadow-sm'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-raised)]/60 hover:text-[var(--color-text)] border border-transparent'
                }`}
              >
                <MaterialIcon
                  name="chat"
                  size={17}
                  fill={active ? 1 : 0}
                  color={active ? 'var(--color-mint-accent, #B9E4D0)' : undefined}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />

                <div className="min-w-0 flex-1 pr-6">
                  <div
                    className={
                      active
                        ? 'font-semibold text-[var(--color-mint-accent,#B9E4D0)] truncate'
                        : 'font-medium text-[var(--color-text)] group-hover:text-[var(--color-mint-accent,#B9E4D0)] truncate transition-colors'
                    }
                  >
                    {conv.title || 'Untitled Conversation'}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--color-muted)] font-mono">
                    <span>{formatRelativeTime(conv.updated_at)}</span>
                    {conv.message_count !== undefined && conv.message_count > 0 && (
                      <>
                        <span aria-hidden="true">•</span>
                        <span>{conv.message_count} {conv.message_count === 1 ? 'msg' : 'msgs'}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Conversation options menu */}
                <div
                  className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="h-6 w-6 flex items-center justify-center rounded hover:bg-[var(--color-raised)] text-[var(--color-muted)] hover:text-[var(--color-text)] transition"
                        aria-label="Conversation options"
                      >
                        <MaterialIcon name="more_vert" size={15} aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        destructive
                        onClick={() => onDeleteConv(conv.id)}
                        className="text-xs text-[var(--color-error)] flex items-center gap-2 cursor-pointer"
                      >
                        <MaterialIcon name="delete" size={14} aria-hidden="true" />
                        <span>Delete chat</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sidebar Footer context */}
      <div className="p-3 border-t border-[var(--color-border)] text-[11px] text-[var(--color-muted)] font-mono flex items-center justify-between bg-[var(--color-raised)]/20">
        <span>Conversations</span>
        <span>{conversations.length} saved</span>
      </div>
    </aside>
  );
}
