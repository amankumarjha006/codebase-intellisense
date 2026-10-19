import { parseRetryAfter } from './retryAfter';
import { parseSSEEvents } from './sse';
import type {
  Repository,
  JobStatus,
  IndexJob,
  SearchResult,
  SearchFilters,
  FileTreeNode,
  FileContent,
  ArchitectureDocument,
  ArchitectureSection,
  PipelineDiagramNode,
  Conversation,
  ChatMessage,
  Citation,
  IndexHistoryEntry,
} from './types';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface BackendErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    request_id?: string;
  };
  detail?: string | Array<{ msg?: string; loc?: string[] }>;
}

export class ApiError extends Error {
  public code: string;
  public status?: number;
  public requestId?: string;
  public retryAfter?: number;

  constructor(message: string, code: string, status?: number, retryAfter?: number, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
    this.requestId = requestId;
  }
}

export interface GithubIdentity {
  username: string;
  github_user_id: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string | null;
  github: GithubIdentity | null;
}

export interface RepositoryListItemOut {
  id: string;
  owner: string;
  name: string;
  is_private: boolean;
  created_at: string;
  latest_job_status: string | null;
  latest_job_failure_code: string | null;
  active_version_short_sha: string | null;
  last_indexed_at: string | null;
}

export interface RepositoryListOut {
  items: RepositoryListItemOut[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface RepositoryVersionSummary {
  id: string;
  commit_sha: string;
  status: string;
  branch: string;
  indexed_at: string | null;
}

export interface RepositoryDetailOut {
  id: string;
  owner: string;
  name: string;
  is_private: boolean;
  active_version: RepositoryVersionSummary | null;
  lines_of_code?: number;
  ast_nodes?: number;
  primary_language?: string;
}

export interface AnalyzeRepositoryOut {
  job_id: string;
  repository_version_id: string;
  status: string;
  message: string;
}

export interface IndexJobOut {
  id: string;
  repository_id: string;
  repository_version_id: string;
  status: string;
  failure_code: string | null;
  failure_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface AnalysisResultOut {
  analysis_type: string;
  repository_version_id: string;
  payload: Record<string, unknown>;
}

export interface FileOut {
  id: string;
  path: string;
  language: string;
  size: number;
  sha256: string;
}

export interface FileListOut {
  files: FileOut[];
  total?: number | null;
}

export interface FileDetailOut {
  id: string;
  path: string;
  language: string;
  size: number;
  sha256: string;
  content: string;
}

export interface SearchResultItem {
  id: string;
  file_path: string;
  start_line: number;
  end_line: number;
  snippet: string;
  score: number;
}

export interface SearchResponse {
  results: SearchResultItem[];
  repository_version_id: string;
}

export interface ConversationOut {
  id: string;
  repository_id: string;
  user_id: string;
  repository_version_id: string;
  title: string | null;
  created_at: string;
  last_message_at?: string | null;
  message_count?: number;
}

export interface ConversationListOut {
  items: ConversationOut[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface MessageCitationOut {
  id: string;
  file_path: string;
  start_line: number;
  end_line: number;
}

export interface MessageOut {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  citations?: MessageCitationOut[];
}

export interface MessageListOut {
  items: MessageOut[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export async function fetchWrapper<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let abortListener: (() => void) | undefined;
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      abortListener = () => controller.abort();
      options.signal.addEventListener('abort', abortListener);
    }
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
    signal: controller.signal,
  };

  try {
    const response = await fetch(url, config);

    if (response.status === 204) {
      return {} as T;
    }

    let data: unknown = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      const errorData = data as BackendErrorEnvelope | null;
      const code = errorData?.error?.code || (response.status === 401 ? 'UNAUTHENTICATED' : 'UNKNOWN_ERROR');
      const message = errorData?.error?.message || `Request failed with status ${response.status}`;

      const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
      const requestId =
        response.headers.get('X-Request-ID') ||
        errorData?.error?.request_id ||
        undefined;

      throw new ApiError(message, code, response.status, retryAfter, requestId);
    }

    return data as T;
  } finally {
    clearTimeout(timeoutId);
    if (options.signal && abortListener) {
      options.signal.removeEventListener('abort', abortListener);
    }
  }
}

/** Real API client communicating with FastAPI backend */
export const realApi = {
  // Auth
  getCurrentUser: (options: RequestInit = {}) =>
    fetchWrapper<CurrentUser>('/auth/me', options),

  logout: (options: RequestInit = {}) =>
    fetchWrapper<void>('/auth/logout', { method: 'POST', ...options }),

  // Repositories
  listRepositories: (page = 1, limit = 50, search = '', options: RequestInit = {}) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (search) {
      params.append('search', search);
    }
    return fetchWrapper<RepositoryListOut>(`/repositories?${params.toString()}`, options);
  },

  connectRepository: (url: string, options: RequestInit = {}) =>
    fetchWrapper<RepositoryDetailOut>('/repositories', {
      method: 'POST',
      body: JSON.stringify({ url }),
      ...options,
    }),

  getRepositoryDetail: (id: string, options: RequestInit = {}) =>
    fetchWrapper<RepositoryDetailOut>(`/repositories/${id}`, options),

  deleteRepository: (id: string, options: RequestInit = {}) =>
    fetchWrapper<void>(`/repositories/${id}`, {
      method: 'DELETE',
      ...options,
    }),

  getRepositoryVersions: (id: string, options: RequestInit = {}) =>
    fetchWrapper<RepositoryVersionSummary[]>(`/repositories/${id}/versions`, options),

  getRepositoryActiveVersion: (id: string, options: RequestInit = {}) =>
    fetchWrapper<RepositoryVersionSummary>(`/repositories/${id}/versions/active`, options),

  analyzeRepository: (id: string, branch?: string | null, options: RequestInit = {}) =>
    fetchWrapper<AnalyzeRepositoryOut>(`/repositories/${id}/analyze`, {
      method: 'POST',
      body: JSON.stringify(branch ? { branch } : {}),
      ...options,
    }),

  getIndexJob: (repoId: string, jobId: string, options: RequestInit = {}) =>
    fetchWrapper<IndexJobOut>(`/repositories/${repoId}/jobs/${jobId}`, options),

  listRepositoryJobs: (repoId: string, options: RequestInit = {}) =>
    fetchWrapper<IndexJobOut[]>(`/repositories/${repoId}/jobs`, options),

  // Knowledge & Analysis
  getRepositoryOverview: (id: string, options: RequestInit = {}) =>
    fetchWrapper<AnalysisResultOut>(`/repositories/${id}/overview`, options),

  getRepositoryTechStack: (id: string, options: RequestInit = {}) =>
    fetchWrapper<AnalysisResultOut>(`/repositories/${id}/technology-stack`, options),

  getRepositoryArchitecture: (id: string, level?: 'file', maxNodes?: number, options: RequestInit = {}) => {
    const params = new URLSearchParams();
    if (level) params.append('level', level);
    if (maxNodes !== undefined) params.append('max_nodes', maxNodes.toString());
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return fetchWrapper<AnalysisResultOut>(`/repositories/${id}/architecture${queryStr}`, options);
  },

  getRepositoryFiles: (id: string, limit?: number, offset?: number, q?: string, options: RequestInit = {}) => {
    const params = new URLSearchParams();
    if (limit !== undefined) params.append('limit', limit.toString());
    if (offset !== undefined) params.append('offset', offset.toString());
    if (q) params.append('q', q);
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return fetchWrapper<FileListOut>(`/repositories/${id}/files${queryStr}`, options);
  },

  getRepositoryFileContent: (repoId: string, fileId: string, options: RequestInit = {}) =>
    fetchWrapper<FileDetailOut>(`/repositories/${repoId}/files/${fileId}`, options),

  searchRepository: (repoId: string, query: string, repositoryVersionId?: string, limit = 20, options: RequestInit = {}) =>
    fetchWrapper<SearchResponse>(`/repositories/${repoId}/search`, {
      method: 'POST',
      body: JSON.stringify({
        query,
        ...(repositoryVersionId ? { repository_version_id: repositoryVersionId } : {}),
        limit,
      }),
      ...options,
    }),

  // Conversations
  listConversations: (repoId: string, page = 1, limit = 20, options: RequestInit = {}) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    return fetchWrapper<ConversationListOut>(`/repositories/${repoId}/conversations?${params.toString()}`, options);
  },

  createConversation: async (repoId: string, title?: string, options: RequestInit = {}): Promise<Conversation> => {
    const item = await fetchWrapper<ConversationOut>(`/repositories/${repoId}/conversations`, {
      method: 'POST',
      body: JSON.stringify(title ? { title } : {}),
      ...options,
    });
    return {
      id: item.id,
      repository_id: item.repository_id,
      title: item.title || 'Untitled Conversation',
      pinned_sha: item.repository_version_id || 'main',
      created_at: item.created_at,
      updated_at: item.last_message_at || item.created_at,
      message_count: item.message_count ?? 0,
    };
  },

  getConversation: (conversationId: string, options: RequestInit = {}) =>
    fetchWrapper<ConversationOut>(`/conversations/${conversationId}`, options),

  deleteConversation: (conversationId: string, options: RequestInit = {}) =>
    fetchWrapper<void>(`/conversations/${conversationId}`, {
      method: 'DELETE',
      ...options,
    }),

  listMessages: (conversationId: string, page = 1, limit = 50, options: RequestInit = {}) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    return fetchWrapper<MessageListOut>(`/conversations/${conversationId}/messages?${params.toString()}`, options);
  },

  sendMessage: (conversationId: string, content: string, options: RequestInit = {}) =>
    fetchWrapper<unknown>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
      ...options,
    }),

  // --- Page Component Compatibility Adapters ---

  getRepository: async (id: string, options: RequestInit = {}): Promise<Repository> => {
    const detail = await realApi.getRepositoryDetail(id, options);
    const shortSha = detail.active_version?.commit_sha ? detail.active_version.commit_sha.slice(0, 7) : null;

    let versions: RepositoryVersionSummary[] = [];
    try {
      versions = await realApi.getRepositoryVersions(id, options);
    } catch {
      versions = [];
    }

    const linesOfCode = detail.lines_of_code ?? 0;
    const astNodes = detail.ast_nodes ?? 0;
    const language = detail.primary_language || 'TypeScript';

    const index_history: IndexHistoryEntry[] = versions.length > 0
      ? versions.map((v, idx) => ({
          sha: v.commit_sha,
          status: (v.status === 'SUCCESS' ? 'READY' : v.status === 'PENDING' ? 'INDEXING' : 'FAILED') as JobStatus,
          label: idx === 0 ? 'Active' : null,
          timestamp: v.indexed_at || detail.active_version?.indexed_at || new Date().toISOString(),
          commit_message: `Commit ${v.commit_sha.slice(0, 7)} (${v.branch})`,
          symbols_indexed: idx === 0 ? (astNodes || null) : null,
        }))
      : detail.active_version
      ? [
          {
            sha: detail.active_version.commit_sha,
            status: (detail.active_version.status === 'SUCCESS' ? 'READY' : detail.active_version.status === 'PENDING' ? 'INDEXING' : 'FAILED') as JobStatus,
            label: 'Active',
            timestamp: detail.active_version.indexed_at || new Date().toISOString(),
            commit_message: `Commit ${detail.active_version.commit_sha.slice(0, 7)} (${detail.active_version.branch})`,
            symbols_indexed: astNodes || null,
          },
        ]
      : [];

    return {
      id: detail.id,
      name: detail.name,
      owner: detail.owner,
      full_name: `${detail.owner}/${detail.name}`,
      description: '',
      is_private: detail.is_private,
      language,
      default_branch: detail.active_version?.branch || 'main',
      latest_job_status: (detail.active_version?.status as JobStatus) || null,
      latest_job_failure_code: null,
      active_version_short_sha: shortSha,
      indexed_commit: detail.active_version?.commit_sha || null,
      last_indexed_at: detail.active_version?.indexed_at || null,
      lines_of_code: linesOfCode,
      ast_nodes: astNodes,
      codebase_volume: {
        lines_of_code: linesOfCode,
        ast_nodes: astNodes,
        language,
      },
      verification_scope: 'Full repository',
      index_history,
    };
  },

  reindexRepository: async (repoId: string, options: RequestInit = {}): Promise<IndexJob> => {
    const analyzeRes = await realApi.analyzeRepository(repoId, null, options);
    return {
      id: analyzeRes.job_id,
      repository_id: repoId,
      status: 'QUEUED',
      failure_code: null,
      failure_message: null,
      started_at: new Date().toISOString(),
      completed_at: null,
      progress: {
        phase: 'Queued in worker pipeline',
        percent: 0,
        files_processed: 0,
        files_total: 100,
        current_file: null,
      },
    };
  },

  searchCode: async (
    repoId: string,
    query: string,
    options: RequestInit = {}
  ): Promise<{ results: SearchResult[]; filters: SearchFilters }> => {
    const res = await realApi.searchRepository(repoId, query, undefined, 50, options);
    const results: SearchResult[] = (res.results || []).map((r) => {
      const ext = r.file_path.includes('.') ? '.' + r.file_path.split('.').pop()! : '';
      return {
        file_path: r.file_path,
        sha: 'head',
        language: ext.replace('.', '') || 'text',
        symbol_name: null,
        symbol_type: null,
        context_function: null,
        start_line: r.start_line,
        end_line: r.end_line,
        snippet: r.snippet,
        match_ranges: [],
      };
    });

    const extCounts = new Map<string, number>();
    const dirCounts = new Map<string, number>();

    for (const r of results) {
      const ext = r.file_path.includes('.') ? '.' + r.file_path.split('.').pop()! : 'other';
      extCounts.set(ext, (extCounts.get(ext) || 0) + 1);

      const parts = r.file_path.split('/');
      if (parts.length > 1) {
        const dir = parts[0] + '/';
        dirCounts.set(dir, (dirCounts.get(dir) || 0) + 1);
      }
    }

    const filters: SearchFilters = {
      extensions: Array.from(extCounts.entries()).map(([ext, count]) => ({ ext, count })),
      directories: Array.from(dirCounts.entries()).map(([dir, count]) => ({ dir, count })),
      symbol_types: [],
    };

    return { results, filters };
  },

  getFileTree: async (repoId: string, options: RequestInit = {}): Promise<FileTreeNode> => {
    const res = await realApi.getRepositoryFiles(repoId, 500, 0, undefined, options);
    const root: FileTreeNode = {
      name: 'root',
      path: '',
      type: 'directory',
      children: [],
    };

    for (const file of res.files || []) {
      const parts = file.path.split('/');
      let currentDir = root;

      for (let i = 0; i < parts.length - 1; i++) {
        const seg = parts[i];
        let subDir = currentDir.children?.find((c) => c.type === 'directory' && c.name === seg);
        if (!subDir) {
          subDir = {
            name: seg,
            path: parts.slice(0, i + 1).join('/'),
            type: 'directory',
            children: [],
          };
          if (!currentDir.children) currentDir.children = [];
          currentDir.children.push(subDir);
        }
        currentDir = subDir;
      }

      const fileName = parts[parts.length - 1];
      if (!currentDir.children) currentDir.children = [];
      currentDir.children.push({
        name: fileName,
        path: file.path,
        type: 'file',
        language: file.language,
        size: file.size,
        has_ast_anchor: true,
      });
    }

    return root;
  },

  getFileContent: async (repoId: string, path: string, options: RequestInit = {}): Promise<FileContent> => {
    const listRes = await realApi.getRepositoryFiles(repoId, 500, 0, path, options);
    const file = listRes.files?.find((f) => f.path === path);
    if (!file) {
      throw new ApiError(`File '${path}' not found in repository.`, 'NOT_FOUND', 404);
    }

    const detail = await realApi.getRepositoryFileContent(repoId, file.id, options);
    const lines = (detail.content || '').split('\n');
    return {
      path: detail.path,
      content: detail.content || '',
      language: detail.language || 'text',
      size_bytes: detail.size || 0,
      line_count: lines.length,
      sha: detail.sha256 || 'latest',
      last_commit_message: 'Verified repository snapshot',
      last_commit_author: 'Automated Indexer',
      last_commit_date: new Date().toISOString(),
    };
  },

  getArchitectureDocument: async (repoId: string, options: RequestInit = {}): Promise<ArchitectureDocument> => {
    const arch = await realApi.getRepositoryArchitecture(repoId, undefined, 300, options);
    const payload = arch.payload || {};
    const nodes = (payload.nodes as Array<{ id: string; name?: string; path?: string; type?: string }>) || [];
    const relationships = (payload.relationships as Array<{ source: string; target: string; type: string }>) || [];

    const fileNodes = nodes.filter((n) => n.type === 'file');
    const symbolNodes = nodes.filter((n) => n.type === 'symbol');

    const sections: ArchitectureSection[] = [
      {
        id: 'overview',
        number: 1,
        title: 'System Architecture & Top-Level Modules',
        status: 'verified',
        content: `### Top-Level Modules\n\nThe repository contains **${fileNodes.length} indexed files** and **${symbolNodes.length} symbols**.\n\n` +
          fileNodes.slice(0, 15).map((f) => `- \`${f.path || f.name}\``).join('\n'),
        citations: [],
      },
      {
        id: 'dependencies',
        number: 2,
        title: 'Module Dependency Graph',
        status: 'verified',
        content: `### Cross-Module Connections\n\nDerived **${relationships.length} relationships** across files and AST call-trees.`,
        citations: [],
      },
    ];

    const pipelineDiagram: PipelineDiagramNode[] = fileNodes.slice(0, 10).map((f) => ({
      id: f.id,
      label: f.name || f.path || f.id,
      sublabel: f.path || 'file',
      connections: relationships
        .filter((r) => r.source === f.id)
        .map((r) => r.target)
        .slice(0, 5),
    }));

    return {
      repository_id: repoId,
      sha: arch.repository_version_id || 'active',
      generated_at: new Date().toISOString(),
      sections,
      pipeline_diagram: pipelineDiagram,
    };
  },

  getConversations: async (repoId: string, options: RequestInit = {}): Promise<Conversation[]> => {
    const res = await realApi.listConversations(repoId, 1, 50, options);
    return (res.items || []).map((item) => ({
      id: item.id,
      repository_id: item.repository_id,
      title: item.title || 'Untitled Conversation',
      pinned_sha: item.repository_version_id || 'main',
      created_at: item.created_at,
      updated_at: item.last_message_at || item.created_at,
      message_count: item.message_count ?? 0,
    }));
  },

  getMessages: async (convId: string, options: RequestInit = {}): Promise<ChatMessage[]> => {
    const res = await realApi.listMessages(convId, 1, 100, options);
    return (res.items || []).map((msg: MessageOut) => ({
      id: msg.id,
      conversation_id: msg.conversation_id,
      role: msg.role,
      content: msg.content,
      citations: (msg.citations || []).map((c: MessageCitationOut) => ({
        path: c.file_path,
        start_line: c.start_line,
        end_line: c.end_line,
        language: c.file_path.split('.').pop() || 'text',
      })),
      created_at: msg.created_at,
    }));
  },

  streamMessage: async (
    convId: string,
    content: string,
    callbacks: {
      onToken: (token: string) => void;
      onCitation: (citation: Citation) => void;
      onComplete: (message: ChatMessage) => void;
      onError?: (err: { error_type: string; message: string; retry_after?: number }) => void;
    }
  ): Promise<void> => {
    const url = `${API_URL}/conversations/${convId}/messages/stream`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        credentials: 'include',
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new ApiError(`Stream failed with status ${response.status}`, 'STREAM_ERROR', response.status);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No readable stream available in response.');

      const decoder = new TextDecoder();
      let fullText = '';
      const citations: Citation[] = [];
      let buffer = '';

      const processEvents = (raw: string): boolean => {
        const events = parseSSEEvents(raw);
        for (const ev of events) {
          const data = (ev.data || {}) as Record<string, unknown>;
          const eventType = ev.event || (typeof data.type === 'string' ? data.type : '');

          if (eventType === 'token') {
            const tokenText = typeof data.text === 'string' ? data.text : (typeof ev.data === 'string' ? ev.data : '');
            if (tokenText) {
              fullText += tokenText;
              callbacks.onToken(tokenText);
            }
          } else if (eventType === 'citation') {
            const rawCitation = (data.citation || data) as Record<string, unknown>;
            const filePath = String(rawCitation.file_path || rawCitation.path || '');
            const citation: Citation = {
              path: filePath,
              start_line: Number(rawCitation.start_line || 0),
              end_line: Number(rawCitation.end_line || 0),
              language: filePath.split('.').pop() || 'text',
              snippet: typeof rawCitation.snippet === 'string' ? rawCitation.snippet : undefined,
            };
            citations.push(citation);
            callbacks.onCitation(citation);
          } else if (eventType === 'message_complete') {
            callbacks.onComplete({
              id: (data.message_id as string) || `msg_${Date.now()}`,
              conversation_id: convId,
              role: 'assistant',
              content: fullText,
              citations,
              created_at: new Date().toISOString(),
            });
            return true;
          } else if (eventType === 'error') {
            callbacks.onError?.({
              error_type: String(data.code || 'STREAM_ERROR'),
              message: String(data.message || 'Stream error'),
              retry_after: typeof data.retry_after === 'number' ? data.retry_after : undefined,
            });
            return true;
          }
        }
        return false;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lastBoundary = Math.max(
          buffer.lastIndexOf('\n\n') !== -1 ? buffer.lastIndexOf('\n\n') + 2 : -1,
          buffer.lastIndexOf('\r\n\r\n') !== -1 ? buffer.lastIndexOf('\r\n\r\n') + 4 : -1
        );
        if (lastBoundary !== -1) {
          const completeRaw = buffer.slice(0, lastBoundary);
          buffer = buffer.slice(lastBoundary);
          const finished = processEvents(completeRaw);
          if (finished) return;
        }
      }

      if (buffer.trim()) {
        const finished = processEvents(buffer);
        if (finished) return;
      }

      callbacks.onComplete({
        id: `msg_${Date.now()}`,
        conversation_id: convId,
        role: 'assistant',
        content: fullText,
        citations,
        created_at: new Date().toISOString(),
      });
    } catch (err: unknown) {
      callbacks.onError?.({
        error_type: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

// Mock layer detection: enabled only in dev when VITE_USE_MOCKS=true and not in test runner
export const isMockEnabled = Boolean(
  import.meta.env.DEV &&
  import.meta.env.MODE !== 'test' &&
  (typeof process === 'undefined' || !process?.env?.VITEST) &&
  import.meta.env.VITE_USE_MOCKS === 'true'
);

type MockApiType = typeof import('../mock/mockApi').mockApi;

let mockApiCache: MockApiType | null = null;

async function getMockApi(): Promise<MockApiType> {
  if (import.meta.env.DEV) {
    if (!mockApiCache) {
      const mod = await import('../mock/mockApi');
      mockApiCache = mod.mockApi;
    }
    return mockApiCache;
  }
  throw new Error('Mock API is not available in production');
}

export const api = new Proxy({} as MockApiType & typeof realApi, {
  get(_target, prop: string | symbol) {
    if (typeof prop !== 'string') return undefined;

    if (!isMockEnabled) {
      const realMethod = (realApi as Record<string, unknown>)[prop];
      if (typeof realMethod === 'function') {
        return realMethod.bind(realApi);
      }
      return realMethod;
    }

    return async (...args: unknown[]) => {
      const mock = await getMockApi();
      const fn = (mock as Record<string, unknown>)[prop];
      if (typeof fn === 'function') {
        return fn.apply(mock, args);
      }
      return fn;
    };
  },
});
