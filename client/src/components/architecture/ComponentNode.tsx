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
        relative w-[240px] rounded-lg p-3 text-left transition-colors cursor-pointer select-none
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
        ${
          isSelected
            ? 'border border-accent bg-surface-overlay shadow-sm'
            : isHighlighted
            ? 'border border-accent/60 bg-surface-overlay'
            : 'border border-white/10 bg-surface-raised hover:border-white/20'
        }
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-accent/70 !border-none"
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
        <span className="shrink-0 text-xs text-text-secondary font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/10">
          L{comp.layer}
        </span>
      </div>

      <div className="font-mono text-xs text-text-secondary truncate mb-2" title={comp.path_prefix || 'root'}>
        {comp.path_prefix || './'}
      </div>

      <div className="flex items-center justify-between text-xs text-text-secondary border-t border-white/[0.08] pt-1.5 mt-1 font-mono">
        <span>{comp.file_count} {comp.file_count === 1 ? 'file' : 'files'}</span>
        {topLanguages && <span className="truncate max-w-[120px] text-right">{topLanguages}</span>}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-accent/70 !border-none"
      />
    </div>
  );
}
