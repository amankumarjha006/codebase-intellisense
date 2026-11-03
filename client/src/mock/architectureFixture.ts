import type { ArchitectureOut, ComponentFilesOut } from '../lib/architecture/types';

export const mockArchitectureFixture: ArchitectureOut = {
  schema_version: 2,
  status: 'ready',
  system: {
    nodes: [
      {
        id: 'sys:client',
        name: 'client',
        kind: 'service',
        metadata: { port: '5173' },
        source_file: 'docker-compose.yml',
        line_number: 4,
      },
      {
        id: 'sys:server',
        name: 'server',
        kind: 'service',
        metadata: { port: '8000' },
        source_file: 'docker-compose.yml',
        line_number: 16,
      },
      {
        id: 'sys:db',
        name: 'postgres',
        kind: 'container',
        metadata: { image: 'pgvector/pgvector:pg16' },
        source_file: 'docker-compose.yml',
        line_number: 28,
      },
      {
        id: 'sys:redis',
        name: 'redis',
        kind: 'container',
        metadata: { image: 'redis:7-alpine' },
        source_file: 'docker-compose.yml',
        line_number: 36,
      },
      {
        id: 'sys:env',
        name: 'Environment Variables',
        kind: 'config',
        metadata: { keys: ['DATABASE_URL', 'REDIS_URL', 'GEMINI_API_KEY'] },
        source_file: '.env.example',
        line_number: 1,
      },
    ],
    edges: [
      { source: 'sys:client', target: 'sys:server', label: 'HTTP / API' },
      { source: 'sys:server', target: 'sys:db', label: 'PostgreSQL' },
      { source: 'sys:server', target: 'sys:redis', label: 'Redis Cache' },
    ],
  },
  components: [
    {
      id: 'comp:client_src_components',
      name: 'UI Components',
      path_prefix: 'client/src/components',
      file_count: 24,
      language_mix: { TypeScript: 24 },
      layer: 0,
      summary: 'Reusable UI elements, design system tokens, dialogs, and navigation widgets.',
    },
    {
      id: 'comp:client_src_pages',
      name: 'Views & Pages',
      path_prefix: 'client/src/pages',
      file_count: 12,
      language_mix: { TypeScript: 12 },
      layer: 1,
      summary: 'Top-level route views connecting UI state with application services.',
    },
    {
      id: 'comp:server_app_api',
      name: 'REST API Endpoints',
      path_prefix: 'server/app/api',
      file_count: 16,
      language_mix: { Python: 16 },
      layer: 2,
      summary: 'FastAPI route controllers handling request validation, auth, and rate limits.',
    },
    {
      id: 'comp:server_app_services',
      name: 'Business Services',
      path_prefix: 'server/app/services',
      file_count: 28,
      language_mix: { Python: 28 },
      layer: 3,
      summary: 'Core domain services including architecture analysis, indexing, and LLM orchestration.',
    },
    {
      id: 'comp:server_app_models',
      name: 'Data Models & Schemas',
      path_prefix: 'server/app/models',
      file_count: 10,
      language_mix: { Python: 10 },
      layer: 4,
      summary: 'SQLAlchemy database tables and Pydantic validation entities.',
    },
  ],
  edges: [
    {
      source: 'comp:client_src_pages',
      target: 'comp:client_src_components',
      weight: 18,
      kind: 'internal',
      cycle: false,
      evidence: [
        {
          source_path: 'client/src/pages/ArchitecturePage.tsx',
          target_path: 'client/src/components/ui/badge.tsx',
          line: 8,
        },
      ],
    },
    {
      source: 'comp:server_app_api',
      target: 'comp:server_app_services',
      weight: 32,
      kind: 'internal',
      cycle: false,
      evidence: [
        {
          source_path: 'server/app/api/v1/endpoints/repositories.py',
          target_path: 'server/app/services/architecture/service.py',
          line: 14,
        },
      ],
    },
    {
      source: 'comp:server_app_services',
      target: 'comp:server_app_models',
      weight: 25,
      kind: 'internal',
      cycle: false,
      evidence: [
        {
          source_path: 'server/app/services/architecture/service.py',
          target_path: 'server/app/models/knowledge.py',
          line: 11,
        },
      ],
    },
  ],
  flows: [
    {
      id: 'flow:get_architecture',
      title: 'GET /repositories/{id}/architecture',
      entry: {
        kind: 'http_route',
        method: 'GET',
        path: '/repositories/{id}/architecture',
        file: 'server/app/api/v1/endpoints/repositories.py',
        line: 120,
      },
      steps: [
        {
          component_id: 'comp:server_app_api',
          caption: 'Authenticates caller session and verifies repository ownership.',
          citations: [
            {
              file_path: 'server/app/api/v1/endpoints/repositories.py',
              start_line: 120,
              end_line: 135,
            },
          ],
        },
        {
          component_id: 'comp:server_app_services',
          caption: 'Loads cached architecture analysis result or runs on-demand extraction.',
          citations: [
            {
              file_path: 'server/app/services/architecture/service.py',
              start_line: 35,
              end_line: 52,
            },
          ],
        },
        {
          component_id: 'comp:server_app_models',
          caption: 'Queries database knowledge repository for analysis payload.',
          citations: [
            {
              file_path: 'server/app/models/knowledge.py',
              start_line: 45,
              end_line: 60,
            },
          ],
        },
      ],
    },
  ],
  coverage: {
    internal_imports_total: 142,
    resolved: 138,
    ratio: 0.97,
    languages_analyzed: ['Python', 'TypeScript'],
    languages_not_analyzed: [{ language: 'Go', files: 4 }],
  },
  limits: {
    truncated: false,
    max_components: 40,
  },
  error: null,
};

export function mockComponentFilesFixture(
  componentId: string,
  page = 1,
  limit = 50
): ComponentFilesOut {
  const dummyFiles = [
    { path: 'server/app/services/architecture/service.py', language: 'python', size_bytes: 5240 },
    { path: 'server/app/services/architecture/components.py', language: 'python', size_bytes: 4120 },
    { path: 'server/app/services/architecture/graph.py', language: 'python', size_bytes: 3890 },
    { path: 'server/app/services/architecture/manifests.py', language: 'python', size_bytes: 3100 },
    { path: 'server/app/services/architecture/flows.py', language: 'python', size_bytes: 4500 },
    { path: 'server/app/services/architecture/schemas.py', language: 'python', size_bytes: 3950 },
  ];

  const total = dummyFiles.length;
  const start = (page - 1) * limit;
  const paged = dummyFiles.slice(start, start + limit);

  return {
    component_id: componentId,
    total,
    page,
    limit,
    files: paged,
  };
}

