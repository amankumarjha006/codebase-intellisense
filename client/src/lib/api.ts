import {
  Repository,
  RepositoryListItem,
  Conversation,
  ChatMessage,
  FileTreeNode,
  FileContent,
  SearchResult,
  SearchFilters,
  ArchitectureDocument,
  User,
  IndexJob,
  ConnectResponse,
  Citation,
} from './types';
import {
  mockCurrentUser,
  mockRepositories,
  mockIndexJobs,
  mockConversations,
  mockMessages,
  mockFileTree,
  mockFileContents,
  mockSearchResults,
  mockSearchFilters,
  mockArchitectureDocument,
} from '../mock/data';
import { sleep, randomHex } from './utils';
import { getStoredScenarios } from './scenarios';

// In-memory clones to allow mutable interactions in the session
let repositories: Repository[] = JSON.parse(JSON.stringify(mockRepositories));
let conversations: Record<string, Conversation[]> = JSON.parse(JSON.stringify(mockConversations));
let messages: Record<string, ChatMessage[]> = JSON.parse(JSON.stringify(mockMessages));
let jobs: Record<string, IndexJob> = JSON.parse(JSON.stringify(mockIndexJobs));

export const api = {
  /** Get current user */
  async getCurrentUser(): Promise<User> {
    await sleep(80);
    return mockCurrentUser;
  },

  /** Get repositories list based on active dashboard scenario */
  async getRepositories(): Promise<RepositoryListItem[]> {
    await sleep(200);
    const scenarios = getStoredScenarios();

    if (scenarios.dashboard === 'loading') {
      await sleep(10000); // simulate infinite loading for previewing skeleton
    }

    if (scenarios.dashboard === 'error') {
      throw new Error("Can't reach the server. Unable to connect to host backend.");
    }

    if (scenarios.dashboard === 'empty') {
      return [];
    }

    return repositories.map((r) => ({
      id: r.id,
      name: r.name,
      owner: r.owner,
      description: r.description,
      is_private: r.is_private,
      language: r.language,
      default_branch: r.default_branch,
      latest_job_status: r.latest_job_status,
      latest_job_failure_code: r.latest_job_failure_code,
      active_version_short_sha: r.active_version_short_sha,
      last_indexed_at: r.last_indexed_at,
      lines_of_code: r.lines_of_code,
      ast_nodes: r.ast_nodes,
    }));
  },

  /** Get repository by ID */
  async getRepository(id: string): Promise<Repository> {
    await sleep(150);
    const repo = repositories.find((r) => r.id === id);
    if (!repo) {
      throw new Error(`Repository with ID '${id}' not found`);
    }
    return repo;
  },

  /** Connect a new repository by GitHub URL */
  async connectRepository(url: string): Promise<ConnectResponse> {
    await sleep(600);

    // Validation checks
    const cleaned = url.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
    const parts = cleaned.split('/');

    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw {
        code: 'INVALID_REQUEST',
        message: 'Please enter a valid GitHub repository URL in the format https://github.com/owner/repo',
      };
    }

    const [owner, name] = parts;

    // Check if already connected
    const existing = repositories.find(
      (r) => r.owner.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === name.toLowerCase()
    );

    if (existing) {
      throw {
        code: 'ALREADY_EXISTS',
        message: `Repository ${owner}/${name} is already connected.`,
        existing_id: existing.id,
      };
    }

    // Simulate rate limit for testing if specific url is supplied
    if (url.includes('ratelimit')) {
      throw {
        code: 'RATE_LIMITED',
        message: 'GitHub API rate limit exceeded for repository check. Please try again in 45 seconds.',
        retry_after: 45,
      };
    }

    const newRepoId = `repo_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${randomHex(4)}`;
    const newRepo: Repository = {
      id: newRepoId,
      name,
      owner,
      full_name: `${owner}/${name}`,
      description: 'Connected via Codebase Intellisense prototype',
      is_private: false,
      language: 'TypeScript',
      default_branch: 'main',
      latest_job_status: 'QUEUED',
      latest_job_failure_code: null,
      active_version_short_sha: null,
      indexed_commit: null,
      last_indexed_at: null,
      lines_of_code: 0,
      ast_nodes: 0,
      codebase_volume: {
        lines_of_code: 0,
        ast_nodes: 0,
        language: 'TypeScript',
      },
      verification_scope: 'Full repository',
      index_history: [],
    };

    repositories.unshift(newRepo);

    // Create tracking job
    jobs[newRepoId] = {
      id: `job_${randomHex(8)}`,
      repository_id: newRepoId,
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

    return {
      repository: newRepo,
    };
  },

  /** Get index job for repository */
  async getIndexJob(repoId: string): Promise<IndexJob | null> {
    await sleep(100);
    return jobs[repoId] || null;
  },

  /** Trigger reindex */
  async reindexRepository(repoId: string): Promise<IndexJob> {
    await sleep(300);
    const repo = repositories.find((r) => r.id === repoId);
    if (!repo) throw new Error('Repository not found');

    const job: IndexJob = {
      id: `job_${randomHex(8)}`,
      repository_id: repoId,
      status: 'QUEUED',
      failure_code: null,
      failure_message: null,
      started_at: new Date().toISOString(),
      completed_at: null,
      progress: {
        phase: 'Cloning repository main branch',
        percent: 5,
        files_processed: 0,
        files_total: 250,
        current_file: null,
      },
    };

    jobs[repoId] = job;
    repo.latest_job_status = 'INDEXING';
    return job;
  },

  /** Get conversations for a repository */
  async getConversations(repoId: string): Promise<Conversation[]> {
    await sleep(120);
    return conversations[repoId] || [];
  },

  /** Create new conversation */
  async createConversation(repoId: string, initialTitle?: string): Promise<Conversation> {
    await sleep(100);
    const repo = repositories.find((r) => r.id === repoId);
    const conv: Conversation = {
      id: `conv_${randomHex(8)}`,
      repository_id: repoId,
      title: initialTitle || 'New question',
      pinned_sha: repo?.active_version_short_sha || 'main',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      message_count: 0,
    };

    if (!conversations[repoId]) {
      conversations[repoId] = [];
    }
    conversations[repoId].unshift(conv);
    messages[conv.id] = [];
    return conv;
  },

  /** Get messages in a conversation */
  async getMessages(convId: string): Promise<ChatMessage[]> {
    await sleep(150);
    return messages[convId] || [];
  },

  /** Send a message and stream assistant response */
  async streamMessage(
    convId: string,
    content: string,
    callbacks: {
      onToken: (token: string) => void;
      onCitation: (citation: Citation) => void;
      onError?: (err: { error_type: string; message: string; retry_after?: number }) => void;
      onComplete: (message: ChatMessage) => void;
    }
  ): Promise<void> {
    // Save user message
    const userMsg: ChatMessage = {
      id: `msg_u_${randomHex(6)}`,
      conversation_id: convId,
      role: 'user',
      content,
      citations: [],
      created_at: new Date().toISOString(),
    };

    if (!messages[convId]) messages[convId] = [];
    messages[convId].push(userMsg);

    const scenarios = getStoredScenarios();

    if (scenarios.chat === 'error_rate_limit') {
      await sleep(400);
      callbacks.onError?.({
        error_type: 'rate_limited',
        message: 'LLM rate limit reached for this session. Please wait before asking another question.',
        retry_after: 30,
      });
      return;
    }

    if (scenarios.chat === 'error_no_answer') {
      await sleep(500);
      callbacks.onError?.({
        error_type: 'no_answer',
        message: 'No confident answer could be grounded from the indexed source files for this question. Try rephrasing or pointing to a specific module.',
      });
      return;
    }

    // Default simulated grounded streaming response
    await sleep(250);

    const sampleTokens = [
      'Based ', 'on ', 'the ', 'indexed ', 'repository ', 'source ', 'files, ',
      'here ', 'is ', 'how ', 'this ', 'is ', 'implemented:\n\n',
      '### Architecture Overview\n',
      'The ', 'module ', 'defines ', 'a ', 'clear ', 'separation ', 'of ', 'concerns ', 'across ', 'the ', 'services.\n\n',
      '```python\n',
      '# Verified implementation pattern\n',
      'class ServiceHandler:\n',
      '    def __init__(self, config: Settings) -> None:\n',
      '        self.config = config\n',
      '        self.retriever = HybridRetriever()\n',
      '```\n\n',
      'Every ', 'method ', 'call ', 'is ', 'verified ', 'against ', 'the ', 'abstract ', 'syntax ', 'tree ',
      'and ', 'matches ', 'the ', 'pinned ', 'commit ', 'SHA.\n\n',
      'Let me know if you would like me to unpack the query optimizer or error handler in more detail.',
    ];

    let fullText = '';
    for (const token of sampleTokens) {
      await sleep(25);
      fullText += token;
      callbacks.onToken(token);
    }

    // Emit citations
    const sampleCitation: Citation = {
      path: 'server/app/services/indexing/ast_chunker.py',
      start_line: 42,
      end_line: 78,
      language: 'python',
      snippet: mockFileContents['server/app/services/indexing/ast_chunker.py']?.content.slice(0, 400),
    };

    await sleep(80);
    callbacks.onCitation(sampleCitation);

    const assistantMsg: ChatMessage = {
      id: `msg_a_${randomHex(6)}`,
      conversation_id: convId,
      role: 'assistant',
      content: fullText,
      citations: [sampleCitation],
      created_at: new Date().toISOString(),
    };

    messages[convId].push(assistantMsg);
    callbacks.onComplete(assistantMsg);
  },

  /** Search code */
  async searchCode(repoId: string, query: string): Promise<{ results: SearchResult[]; filters: SearchFilters }> {
    await sleep(220);
    if (!query.trim()) {
      return { results: mockSearchResults, filters: mockSearchFilters };
    }

    const q = query.toLowerCase();
    const filtered = mockSearchResults.filter(
      (r) =>
        r.file_path.toLowerCase().includes(q) ||
        (r.symbol_name && r.symbol_name.toLowerCase().includes(q)) ||
        r.snippet.toLowerCase().includes(q)
    );

    return {
      results: filtered.length > 0 ? filtered : mockSearchResults,
      filters: mockSearchFilters,
    };
  },

  /** Get file tree */
  async getFileTree(repoId: string): Promise<FileTreeNode> {
    await sleep(150);
    return mockFileTree;
  },

  /** Get file content */
  async getFileContent(repoId: string, path: string): Promise<FileContent> {
    await sleep(120);
    if (mockFileContents[path]) {
      return mockFileContents[path];
    }

    // Generate fallback file content
    const ext = path.split('.').pop() || 'txt';
    const langMap: Record<string, string> = {
      py: 'python',
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      json: 'json',
      md: 'markdown',
      yml: 'yaml',
      yaml: 'yaml',
    };

    return {
      path,
      language: langMap[ext] || 'text',
      size_bytes: 1420,
      line_count: 36,
      sha: '3a8f1c2',
      last_commit_message: 'feat: update file structure and imports',
      last_commit_author: 'Aman Kumar Jha',
      last_commit_date: '2026-10-15T14:30:00Z',
      content: `// Source file: ${path}
// Verified at commit 3a8f1c2

export function initializeModule() {
  console.log("Module initialized for ${path}");
  return { status: "ready" };
}
`,
    };
  },

  /** Get architecture document */
  async getArchitectureDocument(repoId: string): Promise<ArchitectureDocument> {
    await sleep(200);
    const scenarios = getStoredScenarios();

    if (scenarios.architecture === 'empty') {
      return {
        repository_id: repoId,
        sha: '3a8f1c2',
        generated_at: new Date().toISOString(),
        sections: [],
        pipeline_diagram: null,
      };
    }

    return mockArchitectureDocument;
  },
};
