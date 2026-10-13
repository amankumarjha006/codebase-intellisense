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

export interface RepositoryOut {
  id: string;
  owner: string;
  name: string;
  is_private: boolean;
  created_at: string;
  active_version: RepositoryVersionSummary | null;
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

export type RepositoryDetailOut = RepositoryOut;

export interface RepositoryVersionSummary {
  id: string;
  commit_sha: string;
  status: string;
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

export interface BackendError {
  error: {
    code: string;
    message: string;
  };
}

export class ApiError extends Error {
  public code: string;
  public status?: number;
  public retryAfter?: number;

  constructor(message: string, code: string, status?: number, retryAfter?: number) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function fetchWrapper<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
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
      const errorData = data as BackendError | null;
      const message = errorData?.error?.message || `HTTP ${response.status} error occurred`;
      const code = errorData?.error?.code || 'UNKNOWN_ERROR';

      let retryAfter: number | undefined;
      const retryAfterHeader = response.headers.get('Retry-After');
      if (retryAfterHeader) {
        const parsed = parseInt(retryAfterHeader, 10);
        if (!isNaN(parsed) && parsed > 0) {
          retryAfter = parsed;
        }
      }

      throw new ApiError(message, code, response.status, retryAfter);
    }

    return data as T;
  } finally {
    clearTimeout(timeoutId);
    if (options.signal && abortListener) {
      options.signal.removeEventListener('abort', abortListener);
    }
  }
}

export const api = {
  getCurrentUser: (options: RequestInit = {}) =>
    fetchWrapper<CurrentUser>('/auth/me', options),
  logout: (options: RequestInit = {}) =>
    fetchWrapper<void>('/auth/logout', { method: 'POST', ...options }),
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
    fetchWrapper<RepositoryOut>('/repositories', {
      method: 'POST',
      body: JSON.stringify({ url }),
      ...options,
    }),
  getRepositoryDetail: (id: string, options: RequestInit = {}) => 
    fetchWrapper<RepositoryDetailOut>(`/repositories/${id}`, options),
  analyzeRepository: (id: string, branch?: string | null, options: RequestInit = {}) =>
    fetchWrapper<AnalyzeRepositoryOut>(`/repositories/${id}/analyze`, {
      method: 'POST',
      body: JSON.stringify(branch ? { branch } : {}),
      ...options,
    }),
  getIndexJob: (repoId: string, jobId: string, options: RequestInit = {}) =>
    fetchWrapper<IndexJobOut>(`/repositories/${repoId}/jobs/${jobId}`, options),
};
