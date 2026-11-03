import * as React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import type { ArchitectureEdgeData } from '../../lib/architecture/types';
import { MaterialIcon } from '../ui/MaterialIcon';

export function ComponentEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps) {
  const edgeData = data as ArchitectureEdgeData | undefined;
  const edge = edgeData?.edge;
  const isHighlighted = Boolean(edgeData?.isHighlighted);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
  });

  const weight = edge?.weight ?? 1;
  const strokeWidth = isHighlighted ? 3 : Math.min(3, Math.max(1, Math.round(Math.log2(weight + 1))));
  const isCycle = Boolean(edge?.cycle);

  const strokeColor = isHighlighted
    ? 'rgba(255, 255, 255, 0.7)'
    : isCycle
    ? 'rgba(255, 180, 180, 0.5)'
    : 'rgba(255, 255, 255, 0.2)';

  const evidenceCount = edge?.evidence?.length ?? 0;
  const firstEvidence = edge?.evidence?.[0];

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          strokeWidth,
          stroke: strokeColor,
          strokeDasharray: isCycle ? '5,5' : undefined,
        }}
      />
      {isCycle && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#1D1D1B] border border-white/20 text-white/70 shadow-sm"
          >
            <MaterialIcon name="sync" size={12} className="text-white/60 shrink-0" aria-hidden="true" />
            <span>cycle</span>
          </div>
        </EdgeLabelRenderer>
      )}
      {!isCycle && evidenceCount > 0 && isHighlighted && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#1D1D1B] border border-white/20 text-white/80"
            title={firstEvidence ? `${firstEvidence.source_path}:${firstEvidence.line} -> ${firstEvidence.target_path}` : undefined}
          >
            {weight} {weight === 1 ? 'import' : 'imports'}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

