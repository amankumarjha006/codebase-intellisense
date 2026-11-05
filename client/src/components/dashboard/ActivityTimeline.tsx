import * as React from 'react';
import { MaterialIcon } from '../ui/MaterialIcon';
import { StatusDot } from '../ui/StatusDot';
import { Button } from '../ui/button';
import { formatRelativeTime } from '../../lib/utils';
import type { RepositoryListItemOut } from '../../lib/api';

export interface ActivityItem {
  id: string;
  repoId: string;
  repoName: string;
  type: 'INDEXED' | 'INDEXING' | 'FAILED';
  timestamp: string;
  failureCode?: string | null;
}

interface ActivityTimelineProps {
  repositories: RepositoryListItemOut[];
  onTriggerIndex?: (repoId: string) => Promise<void>;
}

export function ActivityTimeline({
  repositories,
  onTriggerIndex,
}: ActivityTimelineProps) {
  const [expanded, setExpanded] = React.useState(false);

  const activities = React.useMemo(() => {
    const list: ActivityItem[] = [];

    for (const repo of repositories) {
      if (repo.latest_job_status === 'INDEXING' || repo.latest_job_status === 'QUEUED') {
        list.push({
          id: `${repo.id}-active`,
          repoId: repo.id,
          repoName: `${repo.owner}/${repo.name}`,
          type: 'INDEXING',
          timestamp: repo.last_indexed_at || repo.created_at,
        });
      } else if (repo.latest_job_status === 'FAILED') {
        list.push({
          id: `${repo.id}-failed`,
          repoId: repo.id,
          repoName: `${repo.owner}/${repo.name}`,
          type: 'FAILED',
          timestamp: repo.last_indexed_at || repo.created_at,
          failureCode: repo.latest_job_failure_code,
        });
      } else if (repo.last_indexed_at) {
        list.push({
          id: `${repo.id}-indexed`,
          repoId: repo.id,
          repoName: `${repo.owner}/${repo.name}`,
          type: 'INDEXED',
          timestamp: repo.last_indexed_at,
        });
      }
    }

    return list.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [repositories]);

  if (activities.length === 0) return null;

  const failureCount = activities.filter((a) => a.type === 'FAILED').length;

  return (
    <div className="rounded-lg border border-white/10 bg-surface-raised overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-surface-overlay/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <MaterialIcon
            name={expanded ? 'expand_more' : 'chevron_right'}
            size={18}
            className="text-text-tertiary"
          />
          <span className="text-xs font-semibold text-text-primary">
            Indexing activity
          </span>
          <span className="text-xs text-text-tertiary tabular-nums font-mono">
            ({activities.length})
          </span>
          {failureCount > 0 && (
            <span className="text-[10px] font-medium text-status-red bg-status-red/10 px-1.5 py-0.5 rounded">
              {failureCount} failed
            </span>
          )}
        </div>

        <span className="text-[11px] text-text-tertiary">
          {expanded ? 'Hide events' : 'Show events'}
        </span>
      </button>

      {expanded && (
        <div className="divide-y divide-white/5 border-t border-white/5">
          {activities.map((item) => (
            <div
              key={item.id}
              className="p-3 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <StatusDot
                  status={
                    item.type === 'INDEXING'
                      ? 'indexing'
                      : item.type === 'FAILED'
                      ? 'failed'
                      : 'ready'
                  }
                />
                <span className="font-medium text-text-primary truncate">
                  {item.repoName}
                </span>
                <span className="text-text-tertiary">
                  {item.type === 'INDEXING'
                    ? 'Indexing repository...'
                    : item.type === 'FAILED'
                    ? 'Indexing failed'
                    : 'Indexed successfully'}
                </span>
                {item.failureCode && (
                  <span className="font-mono text-[10px] text-status-red bg-status-red/10 px-1 py-0.5 rounded">
                    {item.failureCode}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-text-tertiary tabular-nums">
                  {formatRelativeTime(item.timestamp)}
                </span>
                {item.type === 'FAILED' && onTriggerIndex && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onTriggerIndex(item.repoId)}
                    className="h-6 px-1.5 text-xs text-text-secondary hover:text-text-primary"
                  >
                    Retry
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

