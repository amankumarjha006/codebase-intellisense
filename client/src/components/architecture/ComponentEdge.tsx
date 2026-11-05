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
    ? '#8AB4F8'
    : isCycle
    ? '#F28B82'
    : 'rgba(255, 255, 255, 0.25)';

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
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono bg-surface-raised border border-status-failed/40 text-status-failed shadow-sm"
          >
            <MaterialIcon name="sync" size={14} className="text-status-failed shrink-0" aria-hidden="true" />
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
            className="px-2 py-0.5 rounded text-xs font-mono bg-surface-raised border border-white/10 text-text-primary shadow-sm"
            title={firstEvidence ? `Approximate evidence: ${firstEvidence.source_path}:${firstEvidence.line} -> ${firstEvidence.target_path}` : 'Approximate import evidence'}
          >
            approx. {weight} {weight === 1 ? 'import' : 'imports'}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
