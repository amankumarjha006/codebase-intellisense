import { describe, it, expect } from 'vitest';
import { selectStepHighlight } from './highlight';
import type { DataFlowOut } from './types';

describe('selectStepHighlight', () => {
  const sampleFlow: DataFlowOut = {
    id: 'flow-1',
    title: 'GET /api/v1/repos',
    entry: {
      kind: 'http_route',
      method: 'GET',
      path: '/api/v1/repos',
      file: 'server/app/api.py',
      line: 10,
    },
    steps: [
      {
        component_id: 'comp:api',
        caption: 'API route entry',
        citations: [],
      },
      {
        component_id: 'comp:services',
        caption: 'Service lookup',
        citations: [],
      },
      {
        component_id: 'comp:db',
        caption: 'Database query',
        citations: [],
      },
    ],
  };

  it('returns empty sets for null/undefined flow or invalid step index', () => {
    expect(selectStepHighlight(null, 0)).toEqual({
      highlightedComponentIds: new Set(),
      highlightedEdgeKeys: new Set(),
    });
    expect(selectStepHighlight(sampleFlow, -1)).toEqual({
      highlightedComponentIds: new Set(),
      highlightedEdgeKeys: new Set(),
    });
    expect(selectStepHighlight(sampleFlow, 99)).toEqual({
      highlightedComponentIds: new Set(),
      highlightedEdgeKeys: new Set(),
    });
  });

  it('highlights current component and next component + edge for step 0', () => {
    const result = selectStepHighlight(sampleFlow, 0);
    expect(result.highlightedComponentIds.has('comp:api')).toBe(true);
    expect(result.highlightedComponentIds.has('comp:services')).toBe(true);
    expect(result.highlightedComponentIds.has('comp:db')).toBe(false);
    expect(result.highlightedEdgeKeys.has('comp:api->comp:services')).toBe(true);
  });

  it('highlights step 1 and step 2 + edge', () => {
    const result = selectStepHighlight(sampleFlow, 1);
    expect(result.highlightedComponentIds.has('comp:services')).toBe(true);
    expect(result.highlightedComponentIds.has('comp:db')).toBe(true);
    expect(result.highlightedEdgeKeys.has('comp:services->comp:db')).toBe(true);
  });

  it('highlights only final component on last step without next edge', () => {
    const result = selectStepHighlight(sampleFlow, 2);
    expect(result.highlightedComponentIds.has('comp:db')).toBe(true);
    expect(result.highlightedComponentIds.size).toBe(1);
    expect(result.highlightedEdgeKeys.size).toBe(0);
  });
});

