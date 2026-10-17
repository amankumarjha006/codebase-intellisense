import { parseRetryAfter } from './retryAfter';

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

  createConversation: (repoId: string, title?: string, options: RequestInit = {}) =>
    fetchWrapper<ConversationOut>(`/repositories/${repoId}/conversations`, {
      method: 'POST',
      body: JSON.stringify(title ? { title } : {}),
      ...options,
    }),

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
};

// Mock layer detection: enabled only in dev when VITE_USE_MOCKS=true
export const isMockEnabled = Boolean(
  import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true'
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
