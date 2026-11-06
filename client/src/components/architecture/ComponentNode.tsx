import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ArchitectureNodeData } from '../../lib/architecture/types';
import { MaterialIcon } from '../ui/MaterialIcon';

export function ComponentNode({ data, selected }: NodeProps) {
  const nodeData = data as ArchitectureNodeData;
  const comp = nodeData?.component;
  const isHighlighted = Boolean(nodeData?.isHighlighted);
  const isSelected = selected || Boolean(nodeData?.isSelected);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      nodeData?.onSelect?.(comp);
    }
  };

  if (!comp) {
    return null;
  }

  // Top languages string
  const topLanguages = Object.entries(comp.language_mix || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([lang, count]) => `${lang} (${count})`)
    .join(', ');

  return (
    <div
      tabIndex={0}
      role="button"
      aria-label={`Component ${comp.name}, ${comp.file_count} files`}
      onKeyDown={handleKeyDown}
      onClick={() => nodeData?.onSelect?.(comp)}
      className={`
        relative w-[240px] rounded-lg p-3 text-left transition-all duration-200 cursor-pointer select-none
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
        ${
          isSelected
            ? 'border-2 border-accent bg-surface-overlay shadow-md'
            : isHighlighted
            ? 'border-2 border-accent/80 bg-surface-overlay shadow-sm'
            : 'border border-[var(--color-border-strong)] bg-surface shadow-xs hover:border-accent/60 hover:shadow-sm'
        }
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-accent !border-2 !border-[var(--color-surface)] !shadow-xs"
      />

      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <MaterialIcon
            name="folder"
            size={16}
            className="text-text-secondary shrink-0"
            aria-hidden="true"
          />
          <span className="font-medium text-xs text-text-primary truncate">
            {comp.name}
          </span>
        </div>
        <span className="shrink-0 text-xs text-text-secondary font-mono px-1.5 py-0.5 rounded bg-surface-raised border border-[var(--color-border)]">
          L{comp.layer}
        </span>
      </div>

      <div className="font-mono text-xs text-text-secondary truncate mb-2" title={comp.path_prefix || 'root'}>
        {comp.path_prefix || './'}
      </div>

      <div className="flex items-center justify-between text-xs text-text-secondary border-t border-[var(--color-border)] pt-1.5 mt-1 font-mono">
        <span>{comp.file_count} {comp.file_count === 1 ? 'file' : 'files'}</span>
        {topLanguages && <span className="truncate max-w-[120px] text-right">{topLanguages}</span>}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-accent !border-2 !border-[var(--color-surface)] !shadow-xs"
      />
    </div>
  );
}
