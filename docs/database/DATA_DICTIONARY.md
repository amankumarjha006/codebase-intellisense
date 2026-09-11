# Data Dictionary

This document defines the schema for all major tables in the Codebase Intelligence platform.

---

## 1. Auth & Users

### `users`
- **Purpose**: The primary application tenant.
- **PK**: `id` (UUID)
- **Important Fields**: `email` (String, unique), `full_name` (String), `created_at` (Timestamp).

### `github_accounts`
- **Purpose**: Maps a user to their GitHub identity.
- **PK**: `id` (UUID)
- **FK**: `user_id` -> `users.id`
- **Important Fields**: `github_user_id` (String, from GitHub API), `username` (String).
- **Constraints**: `(user_id, github_user_id)` is UNIQUE.

### `github_installations`
- **Purpose**: Represents the GitHub App installation granting access.
- **PK**: `id` (UUID)
- **FK**: `github_account_id` -> `github_accounts.id`
- **Important Fields**: `installation_id` (String), `target_type` (String - "User" or "Organization").

### `user_repositories`
- **Purpose**: Join table representing that an application User has explicit access to a Repository.
- **PK**: `id` (UUID)
- **FK**: `user_id` -> `users.id`, `repository_id` -> `repositories.id`
- **Important Fields**: `created_at` (Timestamp).
- **Constraints**: `(user_id, repository_id)` is UNIQUE.

---

## 2. Repositories

### `repositories`
- **Purpose**: The logical GitHub repository.
- **PK**: `id` (UUID)
- **FK**: `github_installation_id` -> `github_installations.id` (Nullable)
- **Important Fields**: `github_repo_id` (String), `owner` (String), `name` (String), `clone_url` (String), `is_private` (Boolean).
- **Notes**: 
  - `github_installation_id` is NULL when a repository is tracked purely via a direct public URL submission. It is NON-NULL when discovered/accessed through a GitHub App installation.
  - `clone_url` is preserved for MVP to allow the ingestion worker to perform an efficient `git clone` using the installation token as basic authentication.

### `repository_versions`
- **Purpose**: A snapshot of the repository at a specific commit.
- **PK**: `id` (UUID)
- **FK**: `repository_id` -> `repositories.id`
- **Important Fields**: `commit_sha` (String), `branch` (String), `index_status` (String: PENDING, SUCCESS, FAILED).
- **Constraints**: `(repository_id, commit_sha)` is UNIQUE.

### `index_jobs`
- **Purpose**: Tracks the progress of background parsing tasks. A repository version may have multiple index jobs if retries occur.
- **PK**: `id` (UUID)
- **FK**: `repository_id` -> `repositories.id`, `repository_version_id` -> `repository_versions.id`
- **Important Fields**: `status` (String: QUEUED, FETCHING, INDEXING, ANALYZING, READY, FAILED), `error_message` (Text).
- **Constraints**: A partial unique index on `repository_id` where `status IN ('QUEUED', 'FETCHING', 'INDEXING', 'ANALYZING')` enforces only one active job per repository at a time.

---

## 3. Code Knowledge Layer

### `files`
- **Purpose**: Stores metadata about a parsed file.
- **PK**: `id` (UUID)
- **FK**: `repository_version_id` -> `repository_versions.id`
- **Important Fields**: `file_path` (String), `file_name` (String), `language` (String), `size_bytes` (Int), `hash` (String).

### `symbols`
- **Purpose**: AST-extracted code entities (classes, functions, interfaces).
- **PK**: `id` (UUID)
- **FK**: `file_id` -> `files.id`
- **Important Fields**: `name` (String), `qualified_name` (String), `symbol_type` (String), `start_line` (Int), `end_line` (Int).

### `code_chunks`
- **Purpose**: Text slices used for vector and keyword RAG retrieval.
- **PK**: `id` (UUID)
- **FK**: `file_id` -> `files.id`, `symbol_id` -> `symbols.id` (Nullable)
- **Important Fields**: `content` (Text), `start_line` (Int), `end_line` (Int), `chunk_index` (Int).

### `embeddings`
- **Purpose**: Vector representations of CodeChunks.
- **PK**: `id` (UUID)
- **FK**: `code_chunk_id` -> `code_chunks.id`
- **Important Fields**: `embedding` (Vector), `model_name` (String).

### `symbol_relationships`
- **Purpose**: Graph edges connecting specific code symbols.
- **PK**: `id` (UUID)
- **FK**: `repository_version_id` -> `repository_versions.id`, `source_symbol_id` -> `symbols.id`, `target_symbol_id` -> `symbols.id`.
- **Important Fields**: `relationship_type` (String: CALLS, REFERENCES, INHERITS, IMPLEMENTS).

### `file_relationships`
- **Purpose**: Graph edges connecting files as a whole.
- **PK**: `id` (UUID)
- **FK**: `repository_version_id` -> `repository_versions.id`, `source_file_id` -> `files.id`, `target_file_id` -> `files.id`.
- **Important Fields**: `relationship_type` (String: IMPORTS, DEPENDS_ON).

### `analysis_results`
- **Purpose**: Deterministic insights generated from the knowledge layer.
- **PK**: `id` (UUID)
- **FK**: `repository_version_id` -> `repository_versions.id`
- **Important Fields**: `analysis_type` (String: TECH_STACK, ARCHITECTURE, STATISTICS, OVERVIEW), `payload` (JSONB).
- **Constraints**: `UNIQUE(repository_version_id, analysis_type)`.

---

## 4. Chat & Interactions

### `conversations`
- **Purpose**: Chat sessions anchored to a repository.
- **PK**: `id` (UUID)
- **FK**: `repository_id` -> `repositories.id`, `user_id` -> `users.id`, `repository_version_id` -> `repository_versions.id` (Required).
- **Important Fields**: `title` (String), `created_at` (Timestamp).
- **Notes**: `repository_version_id` is required. If omitted by the API request, the backend resolves the active successful version before creating the conversation to preserve the exact grounded state.

### `messages`
- **Purpose**: A single turn in a chat.
- **PK**: `id` (UUID)
- **FK**: `conversation_id` -> `conversations.id`
- **Important Fields**: `role` (String: user, assistant), `content` (Text), `created_at` (Timestamp).

### `citations`
- **Purpose**: Provenance metadata for an AI answer.
- **PK**: `id` (UUID)
- **FK**: `message_id` -> `messages.id`, `code_chunk_id` -> `code_chunks.id` (Nullable).
- **Important Fields**: `file_path` (String), `start_line` (Int), `end_line` (Int).
