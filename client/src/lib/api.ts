export interface CurrentUser {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  github_accounts: { github_user_id: string; username: string }[];
}

export interface RepositoryOut {
  id: string;
  owner: string;
  name: string;
  is_private: boolean;
  created_at: string;
  active_version: RepositoryVersionSummary | null;
}

export interface RepositoryListOut {
  items: RepositoryOut[];
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

export interface BackendError {
  error: {
    code: string;
    message: string;
  };
}

export class ApiError extends Error {
  public code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function fetchWrapper<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  const response = await fetch(url, config);
  
  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as BackendError;
    const message = errorData?.error?.message || 'Unknown API error occurred';
    const code = errorData?.error?.code || 'UNKNOWN_ERROR';
    throw new ApiError(message, code);
  }

  return data as T;
}

export const api = {
  getCurrentUser: () => fetchWrapper<CurrentUser>('/auth/me'),
  logout: () => fetchWrapper<void>('/auth/logout', { method: 'POST' }),
  listRepositories: (page = 1, limit = 50, search = '') => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (search) {
      params.append('search', search);
    }
    return fetchWrapper<RepositoryListOut>(`/repositories?${params.toString()}`);
  },
  connectRepository: (url: string) => 
    fetchWrapper<RepositoryOut>('/repositories', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),
  getRepositoryDetail: (id: string) => 
    fetchWrapper<RepositoryDetailOut>(`/repositories/${id}`),
};
