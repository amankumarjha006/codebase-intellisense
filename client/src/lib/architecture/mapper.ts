import type { Node, Edge } from '@xyflow/react';
import type {
  ArchitectureOut,
  ArchitectureNodeData,
  ArchitectureEdgeData,
  ComponentOut,
} from './types';

export interface MappedGraph {
  nodes: Node<ArchitectureNodeData>[];
  edges: Edge<ArchitectureEdgeData>[];
  layerGroups: Map<number, ComponentOut[]>;
}

/**
 * Pure function mapping backend ArchitectureOut payload into xyflow graph nodes and edges.
 */
export function mapPayloadToGraph(
  payload?: ArchitectureOut | null,
  options?: {
    selectedComponentId?: string | null;
    highlightedComponentIds?: Set<string>;
    highlightedEdgeKeys?: Set<string>;
    onSelectComponent?: (comp: ComponentOut) => void;
  }
): MappedGraph {
  const nodes: Node<ArchitectureNodeData>[] = [];
  const edges: Edge<ArchitectureEdgeData>[] = [];
  const layerGroups = new Map<number, ComponentOut[]>();

  if (!payload || !payload.components) {
    return { nodes, edges, layerGroups };
  }

  const selectedId = options?.selectedComponentId ?? null;
  const highlightedNodes = options?.highlightedComponentIds ?? new Set<string>();
  const highlightedEdges = options?.highlightedEdgeKeys ?? new Set<string>();
  const onSelect = options?.onSelectComponent;

  // 1. Map components to custom nodes
  for (const comp of payload.components) {
    // Record layer grouping
    const currentLayerList = layerGroups.get(comp.layer) || [];
    currentLayerList.push(comp);
    layerGroups.set(comp.layer, currentLayerList);

    const isSelected = selectedId === comp.id;
    const isHighlighted = highlightedNodes.has(comp.id);

    nodes.push({
      id: comp.id,
      type: 'componentNode',
      position: { x: 0, y: 0 },
      data: {
        component: comp,
        isSelected,
        isHighlighted,
        onSelect,
      },
    });
  }

  // 2. Map edges
  if (payload.edges) {
    for (const edge of payload.edges) {
      const edgeKey = `${edge.source}->${edge.target}`;
      const isHighlighted = highlightedEdges.has(edgeKey);

      edges.push({
        id: edgeKey,
        source: edge.source,
        target: edge.target,
        type: 'componentEdge',
        data: {
          edge,
          isHighlighted,
        },
        animated: false,
      });
    }
  }

  return { nodes, edges, layerGroups };
}

