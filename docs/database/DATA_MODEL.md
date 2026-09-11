# Data Model Summary

This document defines the core database entities and the consistency strategies employed in the Codebase Intelligence platform.

## Final Entity List
1. `User`: The primary tenant of the application.
2. `GithubAccount`: The linked GitHub identity of the user.
3. `GithubInstallation`: The specific authorization/app installation granting access to repositories.
4. `UserRepository`: Join table associating an explicit application User with a Repository they can access.
5. `Repository`: The logical GitHub repository.
6. `RepositoryVersion`: A snapshot of a repository at a specific Commit SHA.
7. `IndexJob`: Durable state of background indexing tasks for a given repository. Retries create new jobs.
8. `File`: A parsed file within a repository version.
9. `Symbol`: An AST-extracted code structure (function, class) from a file.
10. `CodeChunk`: A syntax-aware slice of source code used for retrieval. The primary embedding target.
11. `Embedding`: The vector representation of a CodeChunk.
12. `SymbolRelationship`: Edges of the codebase knowledge graph connecting symbols (e.g., CALLS, REFERENCES).
13. `FileRelationship`: Edges of the codebase knowledge graph connecting files (e.g., IMPORTS, DEPENDS_ON).
14. `AnalysisResult`: JSONB storage for deterministic insights (Tech Stack, Architecture).
15. `Conversation`: An AI chat session anchored to a repository.
16. `Message`: A single turn in a chat conversation.
17. `Citation`: Provenance metadata linking an AI message to source code.

## Relationship Summary
- **Ownership/Auth**: 
  Authorization logic relies explicitly on the `UserRepository` entity. 
  `Authenticated User -> UserRepository -> Repository`. 
  This unifies the authorization path whether the repository came from a GitHub App installation or a directly submitted public URL.
- **Versioning (Critical Boundary)**: `Repository` -> `RepositoryVersion`. A single repository can have multiple analyzed commits.
- **Job Tracking**: `RepositoryVersion` -> `IndexJob`. A repository version may have multiple indexing attempts.
- **Knowledge Hierarchy**: `RepositoryVersion` -> `File` -> `Symbol` & `CodeChunk`. 
- **Graph**: 
  - `Symbol` -> `SymbolRelationship` -> `Symbol`.
  - `File` -> `FileRelationship` -> `File`.
- **Embeddings**: `CodeChunk` -> `Embedding`. For MVP, only CodeChunks are embedded.
- **RAG & Chat**: `Conversation` is anchored to both the `Repository` and a strictly required `RepositoryVersion`. `Message` -> `Citation` maps back to the `CodeChunk` and explicitly stores provenance metadata.

## Important Constraints

- **Foreign Key Cascades**: 
  - `ON DELETE CASCADE` is applied downwards from `RepositoryVersion`.
  - Deleting a `UserRepository` record does **NOT** delete the `Repository`. 
  - Deleting a `Repository` will cascade and delete all associated `UserRepository` mapping records.
  - Repository deletion does **NOT** cascade up to User or GithubAccount.
- **Unique Constraints**:
  - `GithubAccount`: `UNIQUE(user_id, github_user_id)`
  - `UserRepository`: `UNIQUE(user_id, repository_id)`
  - `RepositoryVersion`: `UNIQUE(repository_id, commit_sha)`
  - `File`: `UNIQUE(repository_version_id, file_path)`
  - `AnalysisResult`: `UNIQUE(repository_version_id, analysis_type)`
- **Active Index Job Constraint**: PostgreSQL must enforce that only one active indexing job exists for a repository at a time via a partial unique index on `repository_id` where `status IN ('QUEUED', 'FETCHING', 'INDEXING', 'ANALYZING')`.
- **Not Null Constraints**: 
  - Provenance fields (`file_path`, `start_line`, `end_line`) must be strictly non-null on `Symbol`, `CodeChunk`, and `Citation`.
  - `Conversation.repository_version_id` must be non-null to preserve exactly which version grounded the chat. If omitted in the API request, the backend resolves the active successful version before database insertion.
- **Nullable Constraints**: `github_installation_id` on the `Repository` table is **nullable**. `NULL` indicates a public repository submitted directly by URL. **Important**: Private repositories require appropriate GitHub App authorization and cannot be ingested with a NULL installation ID.

## Ingestion Workflows

### 1. Public Repository Creation Flow
1. Authenticated User submits `POST public GitHub URL`. The backend verifies the repository is truly public.
2. Backend creates or finds the `Repository`.
3. `Repository.github_installation_id` is set/kept as `NULL`.
4. Backend creates a `UserRepository` record linking the user to the repository.
5. User now owns/has access to the repository, and it can be analyzed.

### 2. GitHub App Repository Flow
1. Authenticated User authorizes via GitHub App installation.
2. Repository is discovered via API sync.
3. Backend creates or finds the `Repository`.
4. `Repository.github_installation_id` is set to the `GithubInstallation.id`.
5. Backend creates/ensures a `UserRepository` record exists linking the user to the repository.
6. User can access the repository.
*(Note: If a repository is already tracked via one method, we reuse the `Repository` entity and simply ensure the `UserRepository` mapping exists for the new user).*

## Job Lifecycle

Jobs progress linearly unless a failure occurs:
`QUEUED` -> `FETCHING` -> `INDEXING` -> `ANALYZING` -> `READY`

A failure from any processing stage (`QUEUED`, `FETCHING`, `INDEXING`, `ANALYZING`) directly transitions the job to `FAILED`. Retrying an operation simply creates a new `IndexJob` for the same `RepositoryVersion`.

## Version Consistency Strategy
1. Every piece of source code knowledge (Files, Symbols, Chunks, Relationships) is tied via foreign keys to a `RepositoryVersion`, NOT the `Repository`.
2. All database queries made during RAG retrieval MUST be filtered by the "active" `RepositoryVersion` ID.
3. Analysis results are generated per-version. The `UNIQUE(repository_version_id, analysis_type)` constraint prevents duplicate or ambiguous results.
