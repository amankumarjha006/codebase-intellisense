import * as React from 'react';
import { MaterialIcon } from '../ui/MaterialIcon';
import { FileTreeNode } from '../../lib/types';

interface FileTreeProps {
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

export function FileTree({
  tree,
  activeFilePath,
  expandedDirs,
  filterQuery,
  onSelectFile,
  onToggleDir,
}: FileTreeProps) {
  const query = filterQuery.trim().toLowerCase();

  // Helper to check if a node or its children match the query
  const matchesFilter = React.useCallback(
    (node: FileTreeNode): boolean => {
      if (!query) return true;
      if (node.type === 'file') {
        return (
          node.name.toLowerCase().includes(query) ||
          node.path.toLowerCase().includes(query)
        );
      }
      if (node.type === 'directory') {
        if (node.name.toLowerCase().includes(query)) return true;
        return (node.children || []).some((child) => matchesFilter(child));
      }
      return false;
    },
    [query]
  );

  const renderNode = (node: FileTreeNode, depth = 0): React.ReactNode => {
    if (!matchesFilter(node)) return null;

    if (node.type === 'directory') {
      // If there's an active search query, force expanded so matches are immediately visible
      const isExpanded = query ? true : !!expandedDirs[node.path];

      return (
        <div key={node.path || node.name} className="select-none">
          {node.path && (
            <button
              onClick={() => onToggleDir(node.path)}
              aria-expanded={isExpanded}
              aria-label={`Folder ${node.name}`}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60 text-left transition group cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-mint-accent,#B9E4D0)]"
              style={{ paddingLeft: `${depth * 14 + 8}px` }}
            >
              <MaterialIcon
                name={isExpanded ? 'expand_more' : 'chevron_right'}
                size={16}
                fill={0}
                className="text-[var(--color-muted)] shrink-0 transition-transform group-hover:text-[var(--color-text)]"
                aria-hidden="true"
              />
              <MaterialIcon
                name={isExpanded ? 'folder_open' : 'folder'}
                size={16}
                fill={isExpanded ? 1 : 0}
                className={isExpanded ? 'text-[var(--color-mint-accent,#B9E4D0)] shrink-0' : 'text-[var(--color-muted)] shrink-0 group-hover:text-[var(--color-text)]'}
                aria-hidden="true"
              />
              <span className="truncate">{node.name}</span>
            </button>
          )}

          {(!node.path || isExpanded) && node.children && (
            <div role="group" className="space-y-0.5">
              {node.children.map((child) => renderNode(child, node.path ? depth + 1 : depth))}
            </div>
          )}
        </div>
      );
    }

    // File Node
    const isSelected = activeFilePath === node.path;
    const iconName = getFileIcon(node.name);

    return (
      <button
        key={node.path}
        onClick={() => onSelectFile(node.path)}
        aria-selected={isSelected}
        aria-label={`File ${node.name}`}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition select-none truncate group cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-mint-accent,#B9E4D0)] ${
          isSelected
            ? 'bg-[var(--color-mint-selected-bg,#253A32)] text-[var(--color-mint-accent,#B9E4D0)] font-semibold border-l-2 border-[var(--color-mint-accent,#B9E4D0)] shadow-xs'
            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60 border-l-2 border-transparent'
        }`}
        style={{ paddingLeft: `${depth * 14 + 20}px` }}
      >
        <MaterialIcon
          name={iconName}
          size={15}
          fill={isSelected ? 1 : 0}
          className={isSelected ? 'text-[var(--color-mint-accent,#B9E4D0)] shrink-0' : 'text-[var(--color-muted)] shrink-0 group-hover:text-[var(--color-text)]'}
          aria-hidden="true"
        />
        <span className="truncate">{node.name}</span>
      </button>
    );
  };

  if (!tree) return null;

  return <div className="space-y-0.5 py-1">{renderNode(tree)}</div>;
}
