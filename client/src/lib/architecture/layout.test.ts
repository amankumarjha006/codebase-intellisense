import { describe, it, expect } from 'vitest';
import { buildElkGraph, NODE_WIDTH, NODE_HEIGHT } from './layout';
import type { Node, Edge } from '@xyflow/react';
import type { ArchitectureNodeData, ArchitectureEdgeData } from './types';

describe('buildElkGraph', () => {
  it('creates proper ELK structure with RIGHT direction and layer hints', () => {
    const mockNodes: Node<ArchitectureNodeData>[] = [
      {
        id: 'comp:a',
        type: 'componentNode',
        position: { x: 0, y: 0 },
        data: {
          component: {
            id: 'comp:a',
            name: 'A',
            path_prefix: 'a',
            file_count: 5,
            language_mix: {},
            layer: 0,
          },
        },
      },
      {
        id: 'comp:b',
        type: 'componentNode',
        position: { x: 0, y: 0 },
        data: {
          component: {
            id: 'comp:b',
            name: 'B',
            path_prefix: 'b',
            file_count: 8,
            language_mix: {},
            layer: 1,
          },
        },
      },
    ];

    const mockEdges: Edge<ArchitectureEdgeData>[] = [
      {
        id: 'comp:a->comp:b',
        source: 'comp:a',
        target: 'comp:b',
        data: {
          edge: {
            source: 'comp:a',
            target: 'comp:b',
            weight: 3,
            kind: 'internal',
            cycle: false,
            evidence: [],
          },
        },
      },
    ];

    const elkGraph = buildElkGraph(mockNodes, mockEdges);

    expect(elkGraph.id).toBe('root');
    expect(elkGraph.layoutOptions['elk.direction']).toBe('RIGHT');
    expect(elkGraph.layoutOptions['elk.algorithm']).toBe('layered');
    expect(elkGraph.children).toHaveLength(2);
    expect(elkGraph.children[0].width).toBe(NODE_WIDTH);
    expect(elkGraph.children[0].height).toBe(NODE_HEIGHT);
    expect(elkGraph.children[0].layoutOptions?.['elk.layered.layerIndex']).toBe('0');
    expect(elkGraph.children[1].layoutOptions?.['elk.layered.layerIndex']).toBe('1');
    expect(elkGraph.edges).toHaveLength(1);
    expect(elkGraph.edges[0].sources).toEqual(['comp:a']);
    expect(elkGraph.edges[0].targets).toEqual(['comp:b']);
  });
});

