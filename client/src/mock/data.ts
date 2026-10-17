import {
  Repository,
  RepositoryListItem,
  User,
  Conversation,
  ChatMessage,
  FileTreeNode,
  FileContent,
  SearchResult,
  SearchFilters,
  ArchitectureDocument,
  SuggestedQuestion,
  IndexJob,
} from '../lib/types';

export const mockCurrentUser: User = {
  id: 'usr_01h8x9p3k2m4n',
  name: 'Aman Kumar Jha',
  email: 'akjha@example.com',
  github_login: 'amankumarjha006',
  avatar_url: null,
  initials: 'AJ',
};

export const mockRepositories: Repository[] = [
  {
    id: 'repo_codebase_intellisense',
    name: 'codebase-intellisense',
    owner: 'amankumarjha006',
    full_name: 'amankumarjha006/codebase-intellisense',
    description: 'AI-powered GitHub repository intelligence platform for semantic search, architecture visualization, and grounded Q&A.',
    is_private: true,
    language: 'Python',
    default_branch: 'main',
    latest_job_status: 'READY',
    latest_job_failure_code: null,
    active_version_short_sha: '3a8f1c2',
    indexed_commit: '3a8f1c2b5d4e7f8091a2b3c4d5e6f7a8b9c0d1e2',
    last_indexed_at: new Date(Date.now() - 1000 * 60 * 42).toISOString(), // 42 min ago
    lines_of_code: 14290,
    ast_nodes: 8920,
    codebase_volume: {
      lines_of_code: 14290,
      ast_nodes: 8920,
      language: 'Python + TypeScript',
    },
    verification_scope: 'Full repository (AST symbols + vector embeddings)',
    index_history: [
      {
        sha: '3a8f1c2b5d4e7f8091a2b3c4d5e6f7a8b9c0d1e2',
        status: 'READY',
        label: 'Active Version',
        timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
        commit_message: 'feat: add tree-sitter parent-child chunk hierarchy builder',
        symbols_indexed: 8920,
      },
      {
        sha: '7e4b9a1f2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f',
        status: 'READY',
        label: null,
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
        commit_message: 'refactor: decouple embedding provider interface from gemini sdk',
        symbols_indexed: 8410,
      },
      {
        sha: '1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c',
        status: 'READY',
        label: null,
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
        commit_message: 'initial index of repository main branch',
        symbols_indexed: 7950,
      },
    ],
  },
  {
    id: 'repo_fastapi',
    name: 'fastapi',
    owner: 'tiangolo',
    full_name: 'tiangolo/fastapi',
    description: 'FastAPI framework, high performance, easy to learn, fast to code, ready for production.',
    is_private: false,
    language: 'Python',
    default_branch: 'master',
    latest_job_status: 'FAILED',
    latest_job_failure_code: 'EMBEDDING_PROVIDER_RATE_LIMITED',
    active_version_short_sha: '7b1f4a9',
    indexed_commit: '7b1f4a9c8e2d1f0a3b4c5d6e7f8a9b0c1d2e3f4a',
    last_indexed_at: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    lines_of_code: 62400,
    ast_nodes: 34120,
    codebase_volume: {
      lines_of_code: 62400,
      ast_nodes: 34120,
      language: 'Python',
    },
    verification_scope: 'FastAPI core, routing, dependency injection & openapi',
    index_history: [
      {
        sha: 'c4d9e21a8f0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d',
        status: 'FAILED',
        label: 'Failed attempt',
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        commit_message: 'release: 0.115.0 with updated pydantic v2 validation',
        symbols_indexed: null,
      },
      {
        sha: '7b1f4a9c8e2d1f0a3b4c5d6e7f8a9b0c1d2e3f4a',
        status: 'READY',
        label: 'Active (Fallback)',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
        commit_message: 'fix: response validation for union status codes',
        symbols_indexed: 34120,
      },
    ],
  },
  {
    id: 'repo_uv',
    name: 'uv',
    owner: 'astral-sh',
    full_name: 'astral-sh/uv',
    description: 'An extremely fast Python package and project manager, written in Rust.',
    is_private: false,
    language: 'Rust',
    default_branch: 'main',
    latest_job_status: 'INDEXING',
    latest_job_failure_code: null,
    active_version_short_sha: null,
    indexed_commit: '5e2b8c1a9f0d3e4c5b6a7f8e9d0c1b2a3f4e5d6c',
    last_indexed_at: null,
    lines_of_code: 82400,
    ast_nodes: 41200,
    codebase_volume: {
      lines_of_code: 82400,
      ast_nodes: 41200,
      language: 'Rust',
    },
    verification_scope: 'Indexing in progress',
    index_history: [
      {
        sha: '5e2b8c1a9f0d3e4c5b6a7f8e9d0c1b2a3f4e5d6c',
        status: 'INDEXING',
        label: 'In Progress',
        timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
        commit_message: 'perf: parallel wheel extraction and cache verification',
        symbols_indexed: 26368,
      },
    ],
  },
  {
    id: 'repo_react',
    name: 'react',
    owner: 'facebook',
    full_name: 'facebook/react',
    description: 'The library for web and native user interfaces.',
    is_private: false,
    language: 'TypeScript',
    default_branch: 'main',
    latest_job_status: 'READY',
    latest_job_failure_code: null,
    active_version_short_sha: '9d4e21a',
    indexed_commit: '9d4e21ab3c5e7f9a1c2d3e4f5a6b7c8d9e0f1a2b',
    last_indexed_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    lines_of_code: 342100,
    ast_nodes: 184200,
    codebase_volume: {
      lines_of_code: 342100,
      ast_nodes: 184200,
      language: 'TypeScript + JavaScript',
    },
    verification_scope: 'React core, reconciler, server components & hooks',
    index_history: [
      {
        sha: '9d4e21ab3c5e7f9a1c2d3e4f5a6b7c8d9e0f1a2b',
        status: 'READY',
        label: 'Active Version',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        commit_message: 'compiler: track memoization boundaries across async transitions',
        symbols_indexed: 184200,
      },
    ],
  },
  {
    id: 'repo_shadcn_ui',
    name: 'ui',
    owner: 'shadcn',
    full_name: 'shadcn/ui',
    description: 'Beautifully designed components that you can copy and paste into your apps.',
    is_private: false,
    language: 'TypeScript',
    default_branch: 'main',
    latest_job_status: 'READY',
    latest_job_failure_code: null,
    active_version_short_sha: '4f8c12a',
    indexed_commit: '4f8c12ab9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a',
    last_indexed_at: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    lines_of_code: 45120,
    ast_nodes: 21900,
    codebase_volume: {
      lines_of_code: 45120,
      ast_nodes: 21900,
      language: 'TypeScript',
    },
    verification_scope: 'Radix primitives and Tailwind styling recipes',
    index_history: [
      {
        sha: '4f8c12ab9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a',
        status: 'READY',
        label: 'Active Version',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
        commit_message: 'add dialog drawer compound composition helpers',
        symbols_indexed: 21900,
      },
    ],
  },
];

export const mockIndexJobs: Record<string, IndexJob> = {
  repo_uv: {
    id: 'job_uv_idx_01',
    repository_id: 'repo_uv',
    status: 'INDEXING',
    failure_code: null,
    failure_message: null,
    started_at: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    completed_at: null,
    progress: {
      phase: 'Extracting AST symbols & generating embeddings',
      percent: 64,
      files_processed: 256,
      files_total: 400,
      current_file: 'crates/uv-resolver/src/resolver/provider.rs',
    },
  },
  repo_fastapi: {
    id: 'job_fastapi_fail_01',
    repository_id: 'repo_fastapi',
    status: 'FAILED',
    failure_code: 'EMBEDDING_PROVIDER_RATE_LIMITED',
    failure_message: 'Gemini embedding quota reached for current billing tier. Retry in 60s.',
    started_at: new Date(Date.now() - 1000 * 60 * 16).toISOString(),
    completed_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    progress: {
      phase: 'Embedding generation',
      percent: 42,
      files_processed: 120,
      files_total: 285,
      current_file: 'fastapi/routing.py',
    },
  },
};

export const mockConversations: Record<string, Conversation[]> = {
  repo_codebase_intellisense: [
    {
      id: 'conv_ast_hierarchy',
      repository_id: 'repo_codebase_intellisense',
      title: 'AST hierarchy & code chunking pipeline',
      pinned_sha: '3a8f1c2',
      created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      updated_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      message_count: 3,
    },
    {
      id: 'conv_hybrid_search',
      repository_id: 'repo_codebase_intellisense',
      title: 'Hybrid vector & keyword reranking',
      pinned_sha: '3a8f1c2',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      updated_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
      message_count: 2,
    },
    {
      id: 'conv_auth_endpoints',
      repository_id: 'repo_codebase_intellisense',
      title: 'Repository ingestion API auth checks',
      pinned_sha: '3a8f1c2',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      updated_at: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString(),
      message_count: 2,
    },
  ],
};

export const mockMessages: Record<string, ChatMessage[]> = {
  conv_ast_hierarchy: [
    {
      id: 'msg_u_01',
      conversation_id: 'conv_ast_hierarchy',
      role: 'user',
      content: 'How does the indexing pipeline handle AST node chunking and preserve the parent-child hierarchy across functions and classes?',
      citations: [],
      created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    },
    {
      id: 'msg_a_01',
      conversation_id: 'conv_ast_hierarchy',
      role: 'assistant',
      content: `The indexing pipeline uses **Tree-sitter** to parse repository source files into concrete syntax trees, then builds a hierarchical graph of code symbols using \`ASTChunkBuilder\`.

### 1. Structural Symbol Extraction
When a file is ingested, the chunk builder identifies boundary nodes such as \`class_definition\`, \`function_definition\`, and \`decorated_definition\`. Rather than blindly cutting text at arbitrary token limits, it preserves the semantic scope:

- **Parent Container Scope**: Classes and modules maintain an enclosing context window containing docstrings and type annotations.
- **Child Chunks with Breadcrumbs**: Nested methods inherit a scoped path identifier (e.g. \`RepositoryService::sync_branches\`) and references to their parent symbol IDs.

### 2. Overlap & Provenance Preservation
Each generated chunk is tagged with exact byte offsets and line ranges before being sent to the embedding provider:

\`\`\`python
class ChunkMetadata(BaseModel):
    symbol_name: str
    symbol_type: SymbolKind  # CLASS, FUNCTION, METHOD
    parent_symbol_id: Optional[UUID] = None
    file_path: str
    start_line: int
    end_line: int
    scope_path: list[str]
\`\`\`

When a semantic retrieval query matches a child method, the retrieval engine can optionally hydrate the parent class header into the context prompt to ground the LLM's understanding.`,
      citations: [
        {
          path: 'server/app/services/indexing/ast_chunker.py',
          start_line: 42,
          end_line: 88,
          language: 'python',
          snippet: `def extract_hierarchical_chunks(
    tree: Tree,
    source_bytes: bytes,
    file_path: str,
) -> list[CodeChunk]:
    chunks: list[CodeChunk] = []
    cursor = tree.walk()
    
    # Traverse tree while maintaining active scope stack
    scope_stack: list[str] = []
    parent_map: dict[int, UUID] = {}
    
    for node in traverse_ast(tree.root_node):
        if node.type in SCOPED_NODES:
            chunk = build_scoped_chunk(node, source_bytes, file_path, scope_stack)
            chunks.append(chunk)
    return chunks`,
        },
        {
          path: 'server/app/models/symbol.py',
          start_line: 18,
          end_line: 45,
          language: 'python',
          snippet: `class CodeSymbol(Base):
    __tablename__ = "symbols"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    repository_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("repositories.id", ondelete="CASCADE"))
    file_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("files.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), index=True)
    kind: Mapped[str] = mapped_column(String(50))
    parent_symbol_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("symbols.id", ondelete="SET NULL"), nullable=True)
    start_line: Mapped[int]
    end_line: Mapped[int]`,
        },
      ],
      created_at: new Date(Date.now() - 1000 * 60 * 34).toISOString(),
    },
    {
      id: 'msg_u_02',
      conversation_id: 'conv_ast_hierarchy',
      role: 'user',
      content: 'Where are the PostgreSQL pgvector embeddings stored and how are they queried during vector search?',
      citations: [],
      created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    },
  ],
};

export const mockSuggestedQuestions: SuggestedQuestion[] = [
  {
    icon: 'Layers',
    question: 'How does the vector indexing pipeline handle AST node chunking?',
    file_hint: 'server/app/services/indexing/ast_chunker.py',
  },
  {
    icon: 'ShieldCheck',
    question: 'Where is authentication enforced for the repository ingestion endpoints?',
    file_hint: 'server/app/api/v1/auth.py',
  },
  {
    icon: 'Search',
    question: 'Can you explain how semantic search combines dense embeddings with keyword reranking?',
    file_hint: 'server/app/services/retrieval/hybrid.py',
  },
  {
    icon: 'GitBranch',
    question: 'What happens when a commit indexing job fails or experiences rate limits?',
    file_hint: 'server/app/workers/indexing_worker.py',
  },
];

export const mockFileTree: FileTreeNode = {
  name: 'codebase-intellisense',
  path: '',
  type: 'directory',
  children: [
    {
      name: 'server',
      path: 'server',
      type: 'directory',
      children: [
        {
          name: 'app',
          path: 'server/app',
          type: 'directory',
          children: [
            {
              name: 'api',
              path: 'server/app/api',
              type: 'directory',
              children: [
                {
                  name: 'v1',
                  path: 'server/app/api/v1',
                  type: 'directory',
                  children: [
                    { name: 'auth.py', path: 'server/app/api/v1/auth.py', type: 'file', language: 'python', size: 3410, has_ast_anchor: true },
                    { name: 'repositories.py', path: 'server/app/api/v1/repositories.py', type: 'file', language: 'python', size: 8940, has_ast_anchor: true },
                    { name: 'chat.py', path: 'server/app/api/v1/chat.py', type: 'file', language: 'python', size: 12400, has_ast_anchor: true },
                    { name: 'search.py', path: 'server/app/api/v1/search.py', type: 'file', language: 'python', size: 6810, has_ast_anchor: true },
                  ],
                },
              ],
            },
            {
              name: 'services',
              path: 'server/app/services',
              type: 'directory',
              children: [
                {
                  name: 'indexing',
                  path: 'server/app/services/indexing',
                  type: 'directory',
                  children: [
                    { name: 'ast_chunker.py', path: 'server/app/services/indexing/ast_chunker.py', type: 'file', language: 'python', size: 9420, has_ast_anchor: true },
                    { name: 'pipeline.py', path: 'server/app/services/indexing/pipeline.py', type: 'file', language: 'python', size: 14200, has_ast_anchor: true },
                    { name: 'tree_sitter_parser.py', path: 'server/app/services/indexing/tree_sitter_parser.py', type: 'file', language: 'python', size: 7850, has_ast_anchor: true },
                  ],
                },
                {
                  name: 'retrieval',
                  path: 'server/app/services/retrieval',
                  type: 'directory',
                  children: [
                    { name: 'hybrid.py', path: 'server/app/services/retrieval/hybrid.py', type: 'file', language: 'python', size: 11200, has_ast_anchor: true },
                    { name: 'strategies.py', path: 'server/app/services/retrieval/strategies.py', type: 'file', language: 'python', size: 8430, has_ast_anchor: true },
                  ],
                },
              ],
            },
            {
              name: 'models',
              path: 'server/app/models',
              type: 'directory',
              children: [
                { name: 'repository.py', path: 'server/app/models/repository.py', type: 'file', language: 'python', size: 4500, has_ast_anchor: true },
                { name: 'symbol.py', path: 'server/app/models/symbol.py', type: 'file', language: 'python', size: 5200, has_ast_anchor: true },
                { name: 'chunk.py', path: 'server/app/models/chunk.py', type: 'file', language: 'python', size: 3800, has_ast_anchor: true },
              ],
            },
            { name: 'main.py', path: 'server/app/main.py', type: 'file', language: 'python', size: 2800, has_ast_anchor: true },
          ],
        },
        { name: 'requirements.txt', path: 'server/requirements.txt', type: 'file', language: 'text', size: 1200 },
      ],
    },
    {
      name: 'client',
      path: 'client',
      type: 'directory',
      children: [
        {
          name: 'src',
          path: 'client/src',
          type: 'directory',
          children: [
            { name: 'App.tsx', path: 'client/src/App.tsx', type: 'file', language: 'typescript', size: 4100 },
            { name: 'main.tsx', path: 'client/src/main.tsx', type: 'file', language: 'typescript', size: 820 },
            { name: 'index.css', path: 'client/src/index.css', type: 'file', language: 'css', size: 6900 },
          ],
        },
        { name: 'package.json', path: 'client/package.json', type: 'file', language: 'json', size: 1250 },
        { name: 'vite.config.ts', path: 'client/vite.config.ts', type: 'file', language: 'typescript', size: 350 },
      ],
    },
    { name: 'README.md', path: 'README.md', type: 'file', language: 'markdown', size: 3800 },
    { name: 'docker-compose.yml', path: 'docker-compose.yml', type: 'file', language: 'yaml', size: 1400 },
  ],
};

export const mockFileContents: Record<string, FileContent> = {
  'server/app/services/indexing/ast_chunker.py': {
    path: 'server/app/services/indexing/ast_chunker.py',
    language: 'python',
    size_bytes: 9420,
    line_count: 118,
    sha: '3a8f1c2',
    last_commit_message: 'feat: add tree-sitter parent-child chunk hierarchy builder',
    last_commit_author: 'Aman Kumar Jha',
    last_commit_date: '2026-10-15T18:24:00Z',
    content: `"""
Hierarchical AST Chunking Service
Parses source files into discrete syntax-aware code chunks while preserving parent scope.
"""

from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
import tree_sitter
from pydantic import BaseModel, Field

class ScopeContext(BaseModel):
    symbol_name: str
    kind: str
    start_line: int
    end_line: int

class CodeChunk(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    file_path: str
    language: str
    start_line: int
    end_line: int
    raw_content: str
    scope_path: List[str]
    parent_symbol_id: Optional[UUID] = None
    ast_node_type: str

SCOPED_NODE_TYPES = {
    "class_definition",
    "function_definition",
    "async_function_definition",
    "interface_declaration",
    "method_definition",
}

def extract_hierarchical_chunks(
    tree: tree_sitter.Tree,
    source_bytes: bytes,
    file_path: str,
    language: str = "python",
) -> List[CodeChunk]:
    """
    Extracts syntax-aware chunks using tree-sitter AST nodes.
    Maintains parent-child links so class headers provide context to methods.
    """
    chunks: List[CodeChunk] = []
    scope_stack: List[ScopeContext] = []
    
    def visit_node(node: tree_sitter.Node, current_parent_id: Optional[UUID] = None) -> None:
        nonlocal chunks, scope_stack
        
        is_scoped = node.type in SCOPED_NODE_TYPES
        chunk_id = None
        
        if is_scoped:
            name_node = node.child_by_field_name("name")
            symbol_name = (
                source_bytes[name_node.start_byte : name_node.end_byte].decode("utf-8")
                if name_node
                else "anonymous"
            )
            
            start_row = node.start_point[0] + 1
            end_row = node.end_point[0] + 1
            node_text = source_bytes[node.start_byte : node.end_byte].decode("utf-8", errors="replace")
            
            chunk = CodeChunk(
                file_path=file_path,
                language=language,
                start_line=start_row,
                end_line=end_row,
                raw_content=node_text,
                scope_path=[s.symbol_name for s in scope_stack] + [symbol_name],
                parent_symbol_id=current_parent_id,
                ast_node_type=node.type,
            )
            chunks.append(chunk)
            chunk_id = chunk.id
            
            scope_stack.append(ScopeContext(
                symbol_name=symbol_name,
                kind=node.type,
                start_line=start_row,
                end_line=end_row,
            ))
            
        for child in node.children:
            visit_node(child, current_parent_id=chunk_id or current_parent_id)
            
        if is_scoped:
            scope_stack.pop()

    visit_node(tree.root_node)
    return chunks
`,
  },
  'server/app/models/symbol.py': {
    path: 'server/app/models/symbol.py',
    language: 'python',
    size_bytes: 5200,
    line_count: 65,
    sha: '3a8f1c2',
    last_commit_message: 'refactor: database models for ast symbols and citations',
    last_commit_author: 'Aman Kumar Jha',
    last_commit_date: '2026-10-14T11:15:00Z',
    content: `"""
SQLAlchemy Models for Code Symbols and AST Hierarchy
"""

import uuid
from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from server.app.db.base import Base

class CodeSymbol(Base):
    __tablename__ = "symbols"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repository_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), index=True)
    file_path: Mapped[str] = mapped_column(String(500), index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    kind: Mapped[str] = mapped_column(String(50), index=True)
    
    # Hierarchy links
    parent_symbol_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("symbols.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    
    start_line: Mapped[int] = mapped_column(Integer)
    end_line: Mapped[int] = mapped_column(Integer)
    docstring: Mapped[str | None] = mapped_column(String, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSONB, default=dict)
`,
  },
};

export const mockSearchResults: SearchResult[] = [
  {
    file_path: 'server/app/services/indexing/ast_chunker.py',
    sha: '3a8f1c2',
    language: 'python',
    symbol_name: 'extract_hierarchical_chunks',
    symbol_type: 'function',
    context_function: 'def extract_hierarchical_chunks(...)',
    start_line: 42,
    end_line: 52,
    snippet: `def extract_hierarchical_chunks(
    tree: tree_sitter.Tree,
    source_bytes: bytes,
    file_path: str,
    language: str = "python",
) -> List[CodeChunk]:
    """
    Extracts syntax-aware chunks using tree-sitter AST nodes.
    Maintains parent-child links so class headers provide context to methods.
    """`,
    match_ranges: [{ start: 4, end: 31 }],
  },
  {
    file_path: 'server/app/services/indexing/pipeline.py',
    sha: '3a8f1c2',
    language: 'python',
    symbol_name: 'run_indexing_pipeline',
    symbol_type: 'function',
    context_function: 'async def run_indexing_pipeline(...)',
    start_line: 85,
    end_line: 98,
    snippet: `    # Step 2: Extract AST symbols and hierarchical chunks
    logger.info("Extracting AST chunks for %d files", len(source_files))
    for file_path, content in source_files.items():
        tree = parser.parse(content)
        chunks = extract_hierarchical_chunks(tree, content, file_path)
        all_chunks.extend(chunks)`,
    match_ranges: [{ start: 17, end: 44 }],
  },
  {
    file_path: 'server/app/services/retrieval/hybrid.py',
    sha: '3a8f1c2',
    language: 'python',
    symbol_name: 'hybrid_retrieval',
    symbol_type: 'function',
    context_function: 'async def hybrid_retrieval(...)',
    start_line: 64,
    end_line: 78,
    snippet: `async def hybrid_retrieval(
    query: str,
    repo_id: str,
    top_k: int = 8,
) -> list[RetrievedChunk]:
    # Combine pgvector cosine similarity with PostgreSQL ts_vector text search
    dense_results = await vector_search(query, repo_id, limit=top_k * 2)
    sparse_results = await keyword_search(query, repo_id, limit=top_k * 2)
    return reciprocal_rank_fusion(dense_results, sparse_results, top_k=top_k)`,
    match_ranges: [{ start: 10, end: 26 }],
  },
];

export const mockSearchFilters: SearchFilters = {
  extensions: [
    { ext: '.py', count: 18 },
    { ext: '.ts', count: 9 },
    { ext: '.tsx', count: 6 },
    { ext: '.md', count: 3 },
  ],
  directories: [
    { dir: 'server/app/services', count: 14 },
    { dir: 'server/app/api', count: 8 },
    { dir: 'server/app/models', count: 6 },
    { dir: 'client/src', count: 8 },
  ],
  symbol_types: [
    { type: 'Function', count: 16 },
    { type: 'Class', count: 7 },
    { type: 'Method', count: 11 },
    { type: 'Variable', count: 4 },
  ],
};

export const mockArchitectureDocument: ArchitectureDocument = {
  repository_id: 'repo_codebase_intellisense',
  sha: '3a8f1c2',
  generated_at: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
  pipeline_diagram: [
    {
      id: 'ingestion',
      label: 'Repository Ingestion',
      sublabel: 'GitHub Webhook / Git Clone Worker',
      connections: ['parser'],
    },
    {
      id: 'parser',
      label: 'Tree-Sitter AST Parser',
      sublabel: 'Symbol & Hierarchy Extraction',
      connections: ['chunker'],
    },
    {
      id: 'chunker',
      label: 'Hierarchical Chunker',
      sublabel: 'Scoped Syntax Boundary Builder',
      connections: ['vector_store'],
    },
    {
      id: 'vector_store',
      label: 'pgvector + PostgreSQL',
      sublabel: 'Dense Embeddings & Metadata Index',
      connections: ['retriever'],
    },
    {
      id: 'retriever',
      label: 'Hybrid Retrieval Engine',
      sublabel: 'Dense Vector + Sparse RRF Reranking',
      connections: ['synthesis'],
    },
    {
      id: 'synthesis',
      label: 'Grounded Synthesis',
      sublabel: 'Gemini LLM with Exact Line Citations',
      connections: [],
    },
  ],
  sections: [
    {
      id: 'sec_1',
      number: 1,
      title: 'Repository Ingestion & Tree-Sitter AST Pipeline',
      status: 'verified',
      content: `The ingestion engine clones git revisions asynchronously through a dedicated Celery/Redis worker queue. Once files are fetched, the pipeline dispatches source buffers to **Tree-Sitter grammar engines** based on file extensions.

Key responsibilities:
- Filter untracked or binary files using \`.gitignore\` and size heuristics.
- Extract top-level symbols (classes, functions, interfaces, imports) with precise line numbers and byte ranges.
- Form hierarchical parent-child relationships between enclosing containers and nested members.`,
      citations: [
        {
          path: 'server/app/services/indexing/pipeline.py',
          start_line: 14,
          end_line: 62,
          language: 'python',
        },
        {
          path: 'server/app/services/indexing/tree_sitter_parser.py',
          start_line: 22,
          end_line: 48,
          language: 'python',
        },
      ],
    },
    {
      id: 'sec_2',
      number: 2,
      title: 'Hierarchical Chunking & Scope Propagation',
      status: 'verified',
      content: `Standard token-window chunking breaks semantic units across arbitrary splits. To guarantee verifiable citations, the platform enforces **syntax-aware chunking**:

- Chunks strictly observe syntax boundaries defined by AST node definitions.
- Class docstrings and signatures are retained as enclosing context metadata for all child methods.
- Every chunk records its absolute start and end line coordinates relative to the canonical git SHA.`,
      citations: [
        {
          path: 'server/app/services/indexing/ast_chunker.py',
          start_line: 42,
          end_line: 88,
          language: 'python',
        },
      ],
    },
    {
      id: 'sec_3',
      number: 3,
      title: 'Hybrid Retrieval Engine (pgvector + Sparse RRF)',
      status: 'verified',
      content: `Queries are serviced through a hybrid two-stage retrieval architecture:

1. **Dense Vector Search**: PostgreSQL \`pgvector\` executes cosine distance searches against Gemini embeddings (\`text-embedding-004\`).
2. **Lexical Keyword Search**: PostgreSQL full-text search (\`ts_vector\` and \`ts_query\`) captures exact identifiers, function names, and variable tokens.
3. **Reciprocal Rank Fusion (RRF)**: Merges dense and sparse score ranks with a dampening parameter ($k=60$) to prevent vector hallucination when exact symbol tokens are targeted.`,
      citations: [
        {
          path: 'server/app/services/retrieval/hybrid.py',
          start_line: 30,
          end_line: 95,
          language: 'python',
        },
        {
          path: 'server/app/services/retrieval/strategies.py',
          start_line: 12,
          end_line: 45,
          language: 'python',
        },
      ],
    },
    {
      id: 'sec_4',
      number: 4,
      title: 'Grounded LLM Synthesis & Verifiable Provenance',
      status: 'verified',
      content: `All answers generated by the platform must be grounded in verified repository evidence:

- The system prompt instructs the model to only assert facts backed by retrieved code chunks.
- Every factual claim generates a structured citation referencing the exact file path and 1-indexed line range.
- The UI renders these as interactive chips that open the built-in Source Panel, highlighting the verbatim lines from the indexed commit SHA.`,
      citations: [
        {
          path: 'server/app/api/v1/chat.py',
          start_line: 110,
          end_line: 165,
          language: 'python',
        },
      ],
    },
  ],
};
