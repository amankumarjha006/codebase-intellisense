import type { Node, Edge } from '@xyflow/react';
import type { ArchitectureNodeData, ArchitectureEdgeData } from './types';
import ELK from 'elkjs/lib/elk-api.js';

export interface ElkLayoutInput {
  id: string;
  layoutOptions: Record<string, string>;
  children: Array<{
    id: string;
    width: number;
    height: number;
    layoutOptions?: Record<string, string>;
    x?: number;
    y?: number;
  }>;
  edges: Array<{
    id: string;
    sources: string[];
    targets: string[];
  }>;
}

export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 88;

/**
 * Pure function building the ELK graph definition from xyflow nodes and edges.
 * Direction is RIGHT, layered algorithm, with layerIndex hints.
 */
export function buildElkGraph(
  nodes: Node<ArchitectureNodeData>[],
  edges: Edge<ArchitectureEdgeData>[]
): ElkLayoutInput {
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '50',
      'elk.layered.spacing.nodeNodeBetweenLayers': '90',
      'elk.layered.spacing.edgeNodeBetweenLayers': '40',
      'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',
      'elk.edgeRouting': 'SPLINES',
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      layoutOptions: {
        'elk.layered.layerIndex': String(n.data?.component?.layer ?? 0),
      },
    })),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };
}

let elkInstance: InstanceType<typeof ELK> | null = null;

function getElkInstance(): InstanceType<typeof ELK> {
  if (!elkInstance) {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        elkInstance = new ELK({
          workerFactory: () =>
            new Worker(new URL('elkjs/lib/elk-worker.min.js', import.meta.url)),
        });
      } catch {
        elkInstance = null;
      }
    }
    if (!elkInstance) {
      elkInstance = new ELK();
    }
  }
  return elkInstance;
}

/**
 * Runs ELK layout on nodes and edges, returning updated nodes with positioned coordinates.
 * Web Worker is leveraged via ELK workerFactory in browser.
 */
export async function layoutArchitectureGraph(
  nodes: Node<ArchitectureNodeData>[],
  edges: Edge<ArchitectureEdgeData>[]
): Promise<{ nodes: Node<ArchitectureNodeData>[]; edges: Edge<ArchitectureEdgeData>[] }> {
  if (nodes.length === 0) {
    return { nodes, edges };
  }

  const elkGraph = buildElkGraph(nodes, edges);

  let layoutResult: { children?: Array<{ id: string; x?: number; y?: number }> } | undefined;

  try {
    const elk = getElkInstance();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    layoutResult = await elk.layout(elkGraph as any);
  } catch (err) {
    console.warn('ELK layout failed, falling back to grid positions:', err);
    return { nodes, edges };
  }

  const positionMap = new Map<string, { x: number; y: number }>();
  if (layoutResult?.children) {
    for (const child of layoutResult.children) {
      positionMap.set(child.id, {
        x: child.x ?? 0,
        y: child.y ?? 0,
      });
    }
  }

  const laidOutNodes = nodes.map((node) => {
    const pos = positionMap.get(node.id) || { x: 0, y: 0 };
    return {
      ...node,
      position: pos,
    };
  });

  return { nodes: laidOutNodes, edges };
}
