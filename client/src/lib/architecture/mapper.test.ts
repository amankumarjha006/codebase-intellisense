import { describe, it, expect } from 'vitest';
import { mapPayloadToGraph } from './mapper';
import type { ArchitectureOut } from './types';

describe('mapPayloadToGraph', () => {
  const samplePayload: ArchitectureOut = {
    schema_version: 2,
    status: 'ready',
    system: { nodes: [], edges: [] },
    components: [
      {
        id: 'comp:client',
        name: 'client',
        path_prefix: 'client/src',
        file_count: 20,
        language_mix: { TypeScript: 20 },
        layer: 0,
        summary: 'Frontend client SPA',
      },
      {
        id: 'comp:server',
        name: 'server',
        path_prefix: 'server/app',
        file_count: 30,
        language_mix: { Python: 30 },
        layer: 1,
        summary: 'FastAPI backend server',
      },
    ],
    edges: [
      {
        source: 'comp:client',
        target: 'comp:server',
        weight: 12,
        kind: 'internal',
        cycle: false,
        evidence: [
          {
            source_path: 'client/src/api.ts',
            target_path: 'server/app/main.py',
            line: 15,
          },
        ],
      },
    ],
    flows: [],
    coverage: {
      internal_imports_total: 12,
      resolved: 12,
      ratio: 1.0,
      languages_analyzed: ['Python', 'TypeScript'],
      languages_not_analyzed: [],
    },
    limits: {
      truncated: false,
      max_components: 40,
    },
    error: null,
  };

  it('maps empty payload safely', () => {
    const result = mapPayloadToGraph(null);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.layerGroups.size).toBe(0);
  });

  it('maps components into custom nodes and edges', () => {
    const result = mapPayloadToGraph(samplePayload, {
      selectedComponentId: 'comp:client',
    });

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);

    const clientNode = result.nodes.find((n) => n.id === 'comp:client');
    expect(clientNode?.data.isSelected).toBe(true);
    expect(clientNode?.data.component.name).toBe('client');
    expect(clientNode?.data.component.layer).toBe(0);

    const serverNode = result.nodes.find((n) => n.id === 'comp:server');
    expect(serverNode?.data.isSelected).toBe(false);

    expect(result.edges[0].id).toBe('comp:client->comp:server');
    expect(result.edges[0].data?.edge.weight).toBe(12);

    expect(result.layerGroups.get(0)).toHaveLength(1);
    expect(result.layerGroups.get(1)).toHaveLength(1);
  });
});

