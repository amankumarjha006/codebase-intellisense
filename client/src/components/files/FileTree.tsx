import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MaterialIcon } from '../ui/MaterialIcon';
import type { FileTreeNode } from '../../lib/types';

export interface FileTreeProps {
  tree: FileTreeNode | null;
  activeFilePath: string;
  expandedDirs: Record<string, boolean>;
  filterQuery: string;
  onSelectFile: (path: string) => void;
  onToggleDir: (path: string) => void;
}

export function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py':
      return 'terminal';
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return 'code';
    case 'json':
    case 'yaml':
    case 'yml':
    case 'toml':
      return 'data_object';
    case 'md':
    case 'txt':
    case 'rst':
      return 'article';
    case 'sql':
      return 'database';
    case 'css':
    case 'scss':
    case 'html':
      return 'html';
    case 'sh':
    case 'bash':
    case 'ps1':
      return 'terminal';
    case 'dockerfile':
    case 'gitignore':
    case 'env':
      return 'settings';
    default:
      return 'description';
  }
}

interface FlatTreeItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  depth: number;
  isExpanded: boolean;
  language?: string;
  size?: number;
}

function matchesFilter(node: FileTreeNode, query: string): boolean {
  if (!query) return true;
  if (node.type === 'file') {
    return node.name.toLowerCase().includes(query) || node.path.toLowerCase().includes(query);
  }
  if (node.type === 'directory') {
    if (node.name.toLowerCase().includes(query)) return true;
    return (node.children || []).some((child) => matchesFilter(child, query));
  }
  return false;
}

function flattenTree(
  node: FileTreeNode,
  expandedDirs: Record<string, boolean>,
  query: string,
  depth = 0,
  result: FlatTreeItem[] = []
): FlatTreeItem[] {
  if (!node.children) return result;

  // Sort: directories first, then alphabetically
  const sorted = [...node.children].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  for (const child of sorted) {
    if (query && !matchesFilter(child, query)) {
      continue;
    }

    const isDir = child.type === 'directory';
    const isExpanded = query ? true : Boolean(expandedDirs[child.path]);

    result.push({
      id: child.path,
      name: child.name,
      path: child.path,
      type: child.type,
      depth,
      isExpanded,
      language: child.language,
      size: child.size,
    });

    if (isDir && isExpanded) {
      flattenTree(child, expandedDirs, query, depth + 1, result);
    }
  }

  return result;
}

export function FileTree({
  tree,
  activeFilePath,
  expandedDirs,
  filterQuery,
  onSelectFile,
  onToggleDir,
}: FileTreeProps) {
  const query = filterQuery.trim().toLowerCase();
  const parentRef = React.useRef<HTMLDivElement>(null);

  // Flatten tree according to expanded dirs and search query
  const flatItems = React.useMemo(() => {
    if (!tree) return [];
    return flattenTree(tree, expandedDirs, query, 0);
  }, [tree, expandedDirs, query]);

  // TanStack Virtualizer
  const rowVirtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 10,
  });

  if (!tree || flatItems.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-text-secondary font-mono italic">
        {query ? 'No matching files found' : 'No files in repository'}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto overflow-x-hidden font-mono text-xs select-none"
      role="tree"
      aria-label="Repository files directory tree"
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const item = flatItems[virtualRow.index];
          const isFile = item.type === 'file';
          const isActive = isFile && item.path === activeFilePath;

          return (
            <div
              key={item.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {isFile ? (
                <button
                  type="button"
                  onClick={() => onSelectFile(item.path)}
                  role="treeitem"
                  aria-selected={isActive}
                  aria-label={`File ${item.name}`}
                  style={{ paddingLeft: `${item.depth * 14 + 10}px` }}
                  className={`
                    w-full h-full flex items-center gap-2 pr-2 text-left transition-colors truncate
                    focus:outline-none focus-visible:ring-1 focus-visible:ring-accent
                    ${
                      isActive
                        ? 'bg-surface-overlay text-text-primary font-medium border-l-2 border-accent'
                        : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04] border-l-2 border-transparent'
                    }
                  `}
                >
                  <MaterialIcon
                    name={getFileIcon(item.name)}
                    size={14}
                    className={`shrink-0 ${isActive ? 'text-accent' : 'text-text-tertiary'}`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.name}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onToggleDir(item.path)}
                  role="treeitem"
                  aria-expanded={item.isExpanded}
                  aria-label={`Folder ${item.name}`}
                  style={{ paddingLeft: `${item.depth * 14 + 6}px` }}
                  className="w-full h-full flex items-center gap-1.5 pr-2 text-left text-text-secondary hover:text-text-primary hover:bg-white/[0.03] transition-colors truncate focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                >
                  <MaterialIcon
                    name={item.isExpanded ? 'expand_more' : 'chevron_right'}
                    size={16}
                    className="shrink-0 text-text-tertiary"
                    aria-hidden="true"
                  />
                  <MaterialIcon
                    name={item.isExpanded ? 'folder_open' : 'folder'}
                    size={15}
                    className="shrink-0 text-accent/80"
                    aria-hidden="true"
                  />
                  <span className="font-medium truncate text-text-primary">{item.name}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
