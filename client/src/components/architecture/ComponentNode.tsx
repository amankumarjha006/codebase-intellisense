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
        bg-[#161615] border
        focus:outline-none focus:ring-1 focus:ring-white/40
        ${
          isSelected
            ? 'border-white/50 bg-[#1D1D1B]'
            : isHighlighted
            ? 'border-white/40 bg-[#1A1A18]'
            : 'border-white/[0.08] hover:border-white/20'
        }
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-white/40 !border-none"
      />

      <div className="flex items-center justify-between gap-1.5 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <MaterialIcon
            name="folder"
            size={16}
            className="text-white/60 shrink-0"
            aria-hidden="true"
          />
          <span className="font-medium text-xs text-white/90 truncate">
            {comp.name}
          </span>
        </div>
        <span className="shrink-0 text-[10px] text-white/40 font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
          L{comp.layer}
        </span>
      </div>

      <div className="font-mono text-[11px] text-white/50 truncate mb-2" title={comp.path_prefix || 'root'}>
        {comp.path_prefix || './'}
      </div>

      <div className="flex items-center justify-between text-[10px] text-white/40 border-t border-white/[0.06] pt-1.5 mt-1">
        <span>{comp.file_count} {comp.file_count === 1 ? 'file' : 'files'}</span>
        {topLanguages && <span className="truncate max-w-[120px]">{topLanguages}</span>}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-white/40 !border-none"
      />
    </div>
  );
}

