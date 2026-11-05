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
  className?: string;
}

export function ConversationSidebar({
  conversations,
  activeConvId,
  onSelectConv,
  onNewChat,
  onDeleteConv,
  loading = false,
  className = '',
}: ConversationSidebarProps) {
  const [searchFilter, setSearchFilter] = React.useState('');

  const filteredConversations = conversations.filter((c) =>
    (c.title || '').toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <aside
      aria-label="Conversation history"
      className={`bg-surface-raised flex flex-col h-full select-none ${className}`}
    >
      {/* Sidebar Header & New Question Action */}
      <div className="p-3 border-b border-white/10 space-y-2">
        <Button
          size="sm"
          variant="primary"
          onClick={onNewChat}
          className="w-full justify-center gap-1.5 h-8 text-xs font-medium"
          aria-label="Start new conversation"
        >
          <MaterialIcon name="add" size={16} />
          <span>New chat</span>
        </Button>

        {conversations.length > 3 && (
          <div className="relative">
            <MaterialIcon
              name="search"
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-8 pr-2.5 py-1 rounded bg-surface-base border border-white/10 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
            />
          </div>
        )}
      </div>

      {/* Conversations List */}
      <div
        role="listbox"
        aria-label="Saved conversations"
        className="flex-1 overflow-y-auto p-1.5 space-y-0.5 no-scrollbar"
      >
        {loading ? (
          <div className="p-4 text-xs text-text-tertiary text-center">
            Loading conversations...
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-tertiary">
            {searchFilter ? 'No matching conversations' : 'No conversations yet'}
          </div>
        ) : (
          filteredConversations.map((c) => {
            const isActive = c.id === activeConvId;
            return (
              <div
                key={c.id}
                role="option"
                aria-selected={isActive}
                tabIndex={0}
                onClick={() => onSelectConv(c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectConv(c.id);
                  }
                }}
                className={`group relative flex items-center justify-between px-2.5 py-2 rounded-md text-xs cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-surface-overlay text-accent font-medium border-l-2 border-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay/50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-1">
                  <MaterialIcon
                    name="chat_bubble_outline"
                    size={14}
                    className={isActive ? 'text-accent shrink-0' : 'text-text-tertiary group-hover:text-text-secondary shrink-0'}
                  />
                  <span className="truncate">{c.title || 'Untitled conversation'}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[10px] text-text-tertiary tabular-nums font-mono group-hover:hidden">
                    {formatRelativeTime(c.created_at)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="hidden group-hover:flex items-center justify-center h-5 w-5 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-raised"
                        aria-label="Conversation options"
                      >
                        <MaterialIcon name="more_vert" size={13} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-surface-raised border border-white/10 text-xs">
                      <DropdownMenuItem
                        onClick={() => onDeleteConv(c.id)}
                        className="text-status-red gap-2 text-xs cursor-pointer"
                      >
                        <MaterialIcon name="delete" size={13} className="text-status-red" />
                        Delete conversation
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
