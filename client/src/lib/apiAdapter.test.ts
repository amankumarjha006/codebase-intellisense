import { describe, it, expect, vi, beforeEach } from 'vitest';
import { realApi, api } from './api';

describe('Real API Adapters for Page Components', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('maps getRepository(id) to getRepositoryDetail and formats Repository model', async () => {
    vi.spyOn(realApi, 'getRepositoryDetail').mockResolvedValue({
      id: 'repo-123',
      owner: 'testowner',
      name: 'testrepo',
      is_private: false,
      active_version: {
        id: 'ver-1',
        commit_sha: 'a1b2c3d4e5f6',
        branch: 'main',
        status: 'READY',
        indexed_at: '2026-10-17T12:00:00Z',
      },
    });

    const repo = await api.getRepository('repo-123');

    expect(realApi.getRepositoryDetail).toHaveBeenCalledWith('repo-123', {});
    expect(repo.id).toBe('repo-123');
    expect(repo.owner).toBe('testowner');
    expect(repo.name).toBe('testrepo');
    expect(repo.full_name).toBe('testowner/testrepo');
    expect(repo.default_branch).toBe('main');
    expect(repo.active_version_short_sha).toBe('a1b2c3d');
  });

  it('maps searchCode(repoId, query) to searchRepository and returns results and filters', async () => {
    vi.spyOn(realApi, 'searchRepository').mockResolvedValue({
      repository_version_id: 'ver-1',
      results: [
        {
          id: 'chunk-1',
          file_path: 'src/auth/service.ts',
          snippet: 'export function auth() { return true; }',
          start_line: 10,
          end_line: 15,
          score: 0.95,
        },
      ],
    });

    const res = await api.searchCode('repo-123', 'function auth');

    expect(realApi.searchRepository).toHaveBeenCalledWith('repo-123', 'function auth', undefined, 50, {});
    expect(res.results).toHaveLength(1);
    expect(res.results[0].file_path).toBe('src/auth/service.ts');
    expect(res.results[0].start_line).toBe(10);
    expect(res.results[0].snippet).toContain('export function auth');
    expect(res.filters).toBeDefined();
    expect(res.filters.extensions).toBeInstanceOf(Array);
  });

  it('maps getFileTree(repoId) to getRepositoryFiles and constructs a nested directory tree', async () => {
    vi.spyOn(realApi, 'getRepositoryFiles').mockResolvedValue({
      files: [
        { id: 'f1', path: 'src/index.ts', language: 'typescript', size: 100, sha256: 'abc' },
        { id: 'f2', path: 'src/utils/helpers.ts', language: 'typescript', size: 200, sha256: 'def' },
        { id: 'f3', path: 'README.md', language: 'markdown', size: 50, sha256: 'ghi' },
      ],
      total: 3,
    });

    const tree = await api.getFileTree('repo-123');

    expect(realApi.getRepositoryFiles).toHaveBeenCalledWith('repo-123', 500, 0, undefined, {});
    expect(tree.type).toBe('directory');
    expect(tree.children).toBeDefined();

    // Verify root directory children
    const childNames = (tree.children || []).map((c) => c.name);
    expect(childNames).toContain('src');
    expect(childNames).toContain('README.md');

    // Verify nested src/ directory
    const srcDir = tree.children?.find((c) => c.name === 'src');
    expect(srcDir).toBeDefined();
    expect(srcDir?.type).toBe('directory');
    const srcChildNames = (srcDir?.children || []).map((c) => c.name);
    expect(srcChildNames).toContain('index.ts');
    expect(srcChildNames).toContain('utils');
  });

  it('maps getArchitectureDocument(repoId) to getRepositoryArchitecture and formats ArchitectureDocument', async () => {
    vi.spyOn(realApi, 'getRepositoryArchitecture').mockResolvedValue({
      analysis_type: 'ARCHITECTURE',
      repository_version_id: 'ver-1',
      payload: {
        nodes: [
          { id: 'file_1', type: 'file', name: 'main.py', path: 'server/app/main.py' },
          { id: 'file_2', type: 'file', name: 'auth.py', path: 'server/app/auth.py' },
        ],
        relationships: [
          { source: 'file_1', target: 'file_2', type: 'IMPORTS' },
        ],
      },
    });

    const doc = await api.getArchitectureDocument('repo-123');

    expect(realApi.getRepositoryArchitecture).toHaveBeenCalledWith('repo-123', undefined, 300, {});
    expect(doc).toBeDefined();
    expect(doc.repository_id).toBe('repo-123');
    expect(doc.sections).toBeInstanceOf(Array);
    expect(doc.pipeline_diagram).toBeInstanceOf(Array);
  });

  it('maps getConversations and getMessages to conversation endpoints', async () => {
    vi.spyOn(realApi, 'listConversations').mockResolvedValue({
      items: [
        {
          id: 'conv-1',
          repository_id: 'repo-123',
          user_id: 'user-1',
          repository_version_id: 'ver-1',
          title: 'How does auth work?',
          created_at: '2026-10-17T12:00:00Z',
          last_message_at: '2026-10-17T12:05:00Z',
          message_count: 2,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      has_more: false,
    });

    vi.spyOn(realApi, 'listMessages').mockResolvedValue({
      items: [
        {
          id: 'msg-1',
          conversation_id: 'conv-1',
          role: 'user',
          content: 'Hello',
          created_at: '2026-10-17T12:00:00Z',
        },
        {
          id: 'msg-2',
          conversation_id: 'conv-1',
          role: 'assistant',
          content: 'Hi there!',
          created_at: '2026-10-17T12:00:05Z',
        },
      ],
      total: 2,
      page: 1,
      limit: 50,
      has_more: false,
    });

    const convs = await api.getConversations('repo-123');
    expect(realApi.listConversations).toHaveBeenCalledWith('repo-123', 1, 50, {});
    expect(convs).toHaveLength(1);
    expect(convs[0].id).toBe('conv-1');

    const msgs = await api.getMessages('conv-1');
    expect(realApi.listMessages).toHaveBeenCalledWith('conv-1', 1, 100, {});
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('user');
    expect(msgs[1].role).toBe('assistant');
  });

  it('maps createConversation to POST endpoint and returns formatted Conversation model', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        id: 'new-conv-1',
        repository_id: 'repo-123',
        user_id: 'user-1',
        repository_version_id: 'ver-123',
        title: 'New question',
        created_at: '2026-10-17T12:00:00Z',
        last_message_at: '2026-10-17T12:00:00Z',
        message_count: 0,
      }),
    } as Response);

    const conv = await api.createConversation('repo-123', 'New question');
    expect(conv.id).toBe('new-conv-1');
    expect(conv.repository_id).toBe('repo-123');
    expect(conv.title).toBe('New question');
    expect(conv.pinned_sha).toBe('ver-123');
    expect(conv.updated_at).toBe('2026-10-17T12:00:00Z');
    expect(conv.message_count).toBe(0);
  });
});
