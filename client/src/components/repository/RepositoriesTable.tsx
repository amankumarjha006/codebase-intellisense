import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type SortingState,
  flexRender,
} from '@tanstack/react-table';
import { MaterialIcon } from '../ui/MaterialIcon';
import { StatusDot } from '../ui/StatusDot';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { formatRelativeTime, shortSha } from '../../lib/utils';
import { isInputFocused } from '../../lib/keyboard';
import { usePinnedRepos } from '../../lib/pinnedRepos';
import {
  getRepositoryStatusCategory,
  shouldShowStatusFilter,
  type StatusCategory,
} from '../../lib/repositoryTableUtils';
import type { RepositoryListItemOut } from '../../lib/api';

interface RepositoriesTableProps {
  repositories: RepositoryListItemOut[];
  loading?: boolean;
  onTriggerIndex?: (repoId: string) => Promise<void>;
  onDeleteRepository?: (repoId: string) => Promise<void>;
  onOpenConnect?: () => void;
}

export function RepositoriesTable({
  repositories,
  loading = false,
  onTriggerIndex,
  onDeleteRepository,
  onOpenConnect,
}: RepositoriesTableProps) {
  const navigate = useNavigate();
  const { isPinned, togglePin } = usePinnedRepos();

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'last_indexed_at', desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusCategory | 'ALL'>('ALL');
  const [repoToDelete, setRepoToDelete] = React.useState<RepositoryListItemOut | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Keyboard shortcut '/' focuses search input
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !isInputFocused()) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showStatusFilter = React.useMemo(() => {
    return shouldShowStatusFilter(repositories);
  }, [repositories]);

  // Filter repositories by status category
  const filteredData = React.useMemo(() => {
    if (statusFilter === 'ALL') return repositories;
    return repositories.filter((r) => getRepositoryStatusCategory(r) === statusFilter);
  }, [repositories, statusFilter]);

  const columns = React.useMemo<ColumnDef<RepositoryListItemOut>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Repository',
        cell: ({ row }) => {
          const repo = row.original;
          const pinned = isPinned(repo.id);
          return (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePin(repo.id);
                }}
                className="text-text-tertiary hover:text-accent p-1 -m-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                aria-label={pinned ? 'Unpin repository' : 'Pin repository'}
              >
                <MaterialIcon
                  name="keep"
                  fill={pinned ? 1 : 0}
                  size={15}
                  className={pinned ? 'text-accent' : 'text-text-tertiary'}
                />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-medium text-text-primary text-[13px] group-hover:text-accent transition-colors">
                  <span className="truncate">{repo.owner}</span>
                  <span className="text-text-tertiary">/</span>
                  <span className="truncate text-text-primary font-semibold">{repo.name}</span>
                  {repo.is_private && (
                    <MaterialIcon
                      name="lock"
                      size={13}
                      className="text-text-tertiary shrink-0"
                      aria-label="Private repository"
                    />
                  )}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'active_version_short_sha',
        header: 'Indexed commit',
        cell: ({ row }) => {
          const sha = row.original.active_version_short_sha;
          if (!sha) return <span className="text-text-tertiary text-xs">—</span>;
          return (
            <span className="font-mono text-xs text-text-secondary bg-surface-raised px-1.5 py-0.5 rounded border border-white/5 tabular-nums">
              {shortSha(sha)}
            </span>
          );
        },
      },
      {
        accessorKey: 'last_indexed_at',
        header: 'Last indexed',
        cell: ({ row }) => {
          const time = row.original.last_indexed_at;
          if (!time) return <span className="text-text-tertiary text-xs">Never</span>;
          return (
            <span className="text-xs text-text-secondary tabular-nums">
              {formatRelativeTime(time)}
            </span>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const repo = row.original;
          const status = (repo.latest_job_status || '').toUpperCase();
          const category = getRepositoryStatusCategory(repo);

          if (category === 'INDEXING') {
            return (
              <div className="flex items-center gap-2">
                <StatusDot status="indexing" />
                <span className="text-xs text-status-amber capitalize">
                  {status.toLowerCase()}
                </span>
                <span className="text-[11px] text-text-tertiary">in progress</span>
              </div>
            );
          }

          if (category === 'FAILED') {
            return (
              <div className="flex items-center gap-2">
                <StatusDot status="failed" />
                <span className="text-xs text-status-red font-medium">Failed</span>
                {repo.latest_job_failure_code && (
                  <span className="text-[10px] font-mono text-status-red/80 bg-status-red/10 px-1 py-0.5 rounded">
                    {repo.latest_job_failure_code}
                  </span>
                )}
                {onTriggerIndex && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs text-text-secondary hover:text-text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTriggerIndex(repo.id);
                    }}
                  >
                    Retry
                  </Button>
                )}
              </div>
            );
          }

          return (
            <div className="flex items-center gap-2">
              <StatusDot status="ready" />
              <span className="text-xs text-text-secondary">Ready</span>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const repo = row.original;
          const pinned = isPinned(repo.id);
          return (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-text-tertiary hover:text-text-primary hover:bg-surface-overlay"
                    aria-label="Repository actions"
                  >
                    <MaterialIcon name="more_vert" size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-surface-raised border border-white/10 text-text-primary">
                  <DropdownMenuItem
                    onClick={() => onTriggerIndex?.(repo.id)}
                    className="gap-2 cursor-pointer text-xs"
                  >
                    <MaterialIcon name="refresh" size={15} />
                    Re-index repository
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => togglePin(repo.id)}
                    className="gap-2 cursor-pointer text-xs"
                  >
                    <MaterialIcon name="keep" size={15} fill={pinned ? 1 : 0} />
                    {pinned ? 'Unpin repository' : 'Pin repository'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      window.open(`https://github.com/${repo.owner}/${repo.name}`, '_blank', 'noopener,noreferrer')
                    }
                    className="gap-2 cursor-pointer text-xs"
                  >
                    <MaterialIcon name="open_in_new" size={15} />
                    Open on GitHub
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onClick={() => setRepoToDelete(repo)}
                    className="gap-2 cursor-pointer text-xs text-status-red hover:text-status-red focus:text-status-red"
                  >
                    <MaterialIcon name="delete" size={15} className="text-status-red" />
                    Disconnect...
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [isPinned, togglePin, onTriggerIndex]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const handleDeleteConfirm = async () => {
    if (!repoToDelete || !onDeleteRepository) return;
    setIsDeleting(true);
    try {
      await onDeleteRepository(repoToDelete.id);
      setRepoToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Table controls bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <MaterialIcon
            name="search"
            size={16}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
          />
          <Input
            ref={searchInputRef}
            type="search"
            placeholder="Search repositories... (/)"
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8 pr-3 h-8 text-xs bg-surface-raised border-white/10 text-text-primary placeholder:text-text-tertiary focus-visible:ring-accent"
          />
        </div>

        <div className="flex items-center gap-2">
          {showStatusFilter && (
            <div className="flex items-center p-0.5 rounded-md bg-surface-raised border border-white/10 text-xs">
              {(['ALL', 'READY', 'INDEXING', 'FAILED'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                    statusFilter === filter
                      ? 'bg-surface-overlay text-text-primary shadow-xs'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {filter === 'ALL'
                    ? 'All'
                    : filter === 'READY'
                    ? 'Ready'
                    : filter === 'INDEXING'
                    ? 'Indexing'
                    : 'Failed'}
                </button>
              ))}
            </div>
          )}

          {onOpenConnect && (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenConnect}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              <MaterialIcon name="add" size={16} />
              Connect repository
            </Button>
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-lg border border-white/10 bg-surface-raised overflow-hidden">
        <table className="w-full text-left text-xs text-text-secondary">
          <thead className="bg-surface-overlay/50 border-b border-white/10 text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      className="px-4 py-2.5 font-medium select-none"
                    >
                      {canSort ? (
                        <button
                          type="button"
                          className="flex items-center gap-1 hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          <MaterialIcon
                            name={
                              header.column.getIsSorted() === 'asc'
                                ? 'expand_less'
                                : header.column.getIsSorted() === 'desc'
                                ? 'expand_more'
                                : 'unfold_more'
                            }
                            size={14}
                            className="text-text-tertiary"
                          />
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-white/5">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => navigate(`/repositories/${row.original.id}`)}
                  className="group cursor-pointer hover:bg-surface-overlay/60 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-text-tertiary">
                  {loading ? 'Loading repositories...' : 'No repositories found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (< md) */}
      <div className="md:hidden space-y-2.5">
        {table.getRowModel().rows.length > 0 ? (
          table.getRowModel().rows.map((row) => {
            const repo = row.original;
            const category = getRepositoryStatusCategory(repo);
            const pinned = isPinned(repo.id);

            return (
              <div
                key={repo.id}
                onClick={() => navigate(`/repositories/${repo.id}`)}
                className="p-3.5 rounded-lg border border-white/10 bg-surface-raised space-y-2.5 active:bg-surface-overlay/80 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-text-primary text-[13px] truncate">
                      {repo.owner}/{repo.name}
                    </span>
                    {repo.is_private && (
                      <MaterialIcon name="lock" size={12} className="text-text-tertiary shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => togglePin(repo.id)}
                      className="p-1 text-text-tertiary hover:text-accent"
                      aria-label={pinned ? 'Unpin' : 'Pin'}
                    >
                      <MaterialIcon
                        name="keep"
                        fill={pinned ? 1 : 0}
                        size={15}
                        className={pinned ? 'text-accent' : 'text-text-tertiary'}
                      />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-text-tertiary">
                          <MaterialIcon name="more_vert" size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-surface-raised border border-white/10">
                        <DropdownMenuItem onClick={() => onTriggerIndex?.(repo.id)} className="text-xs">
                          Re-index
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setRepoToDelete(repo)} className="text-xs text-status-red">
                          Disconnect...
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-text-secondary pt-1 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <StatusDot
                      status={
                        category === 'INDEXING'
                          ? 'indexing'
                          : category === 'FAILED'
                          ? 'failed'
                          : 'ready'
                      }
                    />
                    <span className="capitalize">
                      {category === 'INDEXING'
                        ? 'Indexing...'
                        : category === 'FAILED'
                        ? 'Failed'
                        : 'Ready'}
                    </span>
                  </div>
                  {repo.active_version_short_sha && (
                    <span className="font-mono text-[11px] text-text-tertiary">
                      {shortSha(repo.active_version_short_sha)}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-text-tertiary rounded-lg border border-white/10 bg-surface-raised">
            {loading ? 'Loading repositories...' : 'No repositories found.'}
          </div>
        )}
      </div>

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={!!repoToDelete} onOpenChange={(open) => !open && setRepoToDelete(null)}>
        <DialogContent className="bg-surface-raised border-white/10 text-text-primary max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Disconnect repository</DialogTitle>
            <DialogDescription className="text-xs text-text-secondary pt-2">
              Are you sure you want to disconnect{' '}
              <strong className="text-text-primary">
                {repoToDelete?.owner}/{repoToDelete?.name}
              </strong>
              ? This will remove indexed symbols, graphs, and cached history for this repository.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRepoToDelete(null)}
              disabled={isDeleting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="text-xs"
            >
              {isDeleting ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

