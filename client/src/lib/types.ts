/* ──────────────────────────────────────────────────────────────
   Types — mirrors the real API contracts.
   ────────────────────────────────────────────────────────────── */

/** Job status progression: QUEUED → FETCHING → INDEXING → ANALYZING → READY */
export type JobStatus =
  | 'QUEUED'
  | 'FETCHING'
  | 'INDEXING'
  | 'ANALYZING'
  | 'READY'
  | 'FAILED';

export type FailureCode =
  | 'CLONE_FAILED'
  | 'REPOSITORY_TOO_LARGE'
  | 'EMBEDDING_PROVIDER_RATE_LIMITED'
  | 'EMBEDDING_PROVIDER_UNAVAILABLE'
  | 'EMBEDDING_PROVIDER_AUTH'
  | 'INTERNAL_ERROR';

export type ConnectErrorCode =
  | 'INVALID_REQUEST'
  | 'GITHUB_API_ERROR'
  | 'ALREADY_EXISTS'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE';

/** Repository as returned by the list endpoint */
export interface RepositoryListItem {
  id: string;
  name: string;
  owner: string;
  description: string;
  is_private: boolean;
  language: string;
  default_branch: string;
  latest_job_status: JobStatus | null;
  latest_job_failure_code: FailureCode | null;
  active_version_short_sha: string | null;
  last_indexed_at: string | null;
  lines_of_code: number;
  ast_nodes: number;
}

/** Detailed repository (for the overview page) */
export interface Repository extends RepositoryListItem {
  full_name: string;
  indexed_commit: string | null;
  codebase_volume: {
    ast_nodes: number;
    lines_of_code: number;
    language: string;
  };
  verification_scope: string;
  index_history: IndexHistoryEntry[];
}

export interface IndexHistoryEntry {
  sha: string;
  status: JobStatus;
  label: string | null;
  timestamp: string;
  commit_message: string;
  symbols_indexed: number | null;
}

/** Index job (used in the connect flow progress view) */
export interface IndexJob {
  id: string;
  repository_id: string;
  status: JobStatus;
  failure_code: FailureCode | null;
  failure_message: string | null;
  started_at: string;
  completed_at: string | null;
  progress: {
    phase: string;
    percent: number;
    files_processed: number;
    files_total: number;
    current_file: string | null;
  } | null;
}

/** Connect request/response */
export interface ConnectRequest {
  url: string;
}

export interface ConnectResponse {
  repository: RepositoryListItem;
}

export interface ConnectError {
  code: ConnectErrorCode;
  message: string;
  retry_after?: number;
  existing_id?: string;
}

/** Chat types */
export interface Conversation {
  id: string;
  repository_id: string;
  title: string;
  pinned_sha: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  created_at: string;
  is_error?: boolean;
  error_type?: 'no_answer' | 'rate_limited' | 'unavailable' | 'still_processing';
  retry_after?: number;
}

export interface Citation {
  path: string;
  start_line: number;
  end_line: number;
  language: string;
  snippet?: string;
}

/** Streaming events */
export type StreamEvent =
  | { type: 'message_start'; message_id: string }
  | { type: 'token'; text: string }
  | { type: 'citation'; citation: Citation }
  | { type: 'message_complete'; message_id: string }
  | { type: 'error'; error_type: string; message: string; retry_after?: number };

/** Search types */
export interface SearchResult {
  file_path: string;
  sha: string;
  language: string;
  symbol_name: string | null;
  symbol_type: string | null;
  context_function: string | null;
  start_line: number;
  end_line: number;
  snippet: string;
  match_ranges: Array<{ start: number; end: number }>;
}

export interface SearchFilters {
  extensions: Array<{ ext: string; count: number }>;
  directories: Array<{ dir: string; count: number }>;
  symbol_types: Array<{ type: string; count: number }>;
}

/** File browser types */
export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  language?: string;
  size?: number;
  has_ast_anchor?: boolean;
}

export interface FileContent {
  path: string;
  content: string;
  language: string;
  size_bytes: number;
  line_count: number;
  sha: string;
  last_commit_message: string;
  last_commit_author: string;
  last_commit_date: string;
}

/** Architecture types */
export interface ArchitectureSection {
  id: string;
  number: number;
  title: string;
  status: 'verified' | 'synthesizing' | 'queued' | 'pending';
  content: string | null;
  citations: Citation[];
}

export interface ArchitectureDocument {
  repository_id: string;
  sha: string;
  generated_at: string;
  sections: ArchitectureSection[];
  pipeline_diagram: PipelineDiagramNode[] | null;
}

export interface PipelineDiagramNode {
  id: string;
  label: string;
  sublabel: string;
  connections: string[];
}

/** User */
export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  github_login: string;
  initials: string;
}

/** Suggested questions for new chat */
export interface SuggestedQuestion {
  icon: string;
  question: string;
  file_hint: string;
}
