# Database Architectural Decisions

## ADR DB-001: Separation of Application User and GitHub Identity
**Context:** Users sign in to the application. The application accesses GitHub on their behalf. If a user loses access to a GitHub account, changes accounts, or we eventually add alternative auth methods, tying the internal user identity directly to a GitHub ID is brittle.
**Decision:** Create separate `User`, `GithubAccount`, and `GithubInstallation` entities.
**Reason:** 
- `User` is the application-level tenant.
- `GithubAccount` represents the linked GitHub profile (for display and ID mapping).
- `GithubInstallation` represents the specific authorization granted to the GitHub App (containing installation IDs and token metadata).
**Consequences:** Clear isolation of concerns.

## ADR DB-007: Explicit User-Repository Access Model
**Context:** The API supports repositories discovered via a user's GitHub App installation AND public repositories submitted directly by URL. For public repositories, there is no `GithubInstallation` to join against for authorization, making a pure `User -> GithubAccount -> GithubInstallation -> Repository` join path insufficient.
**Decision:** Introduce a `UserRepository` mapping table and make `Repository.github_installation_id` nullable.
**Reason:**
- Unifies the authorization abstraction. All API checks simply query the `UserRepository` relationship to determine if a User has access to a Repository.
- `NULL` installation IDs elegantly represent directly submitted public repositories.
- Disentangles the ingestion mechanism (App vs Public URL) from the application access boundary.
**Consequences:** A `UserRepository` record MUST be explicitly created when a repository is ingested, regardless of whether it came from a public URL or a GitHub App sync. The backend relies on this record, avoiding duplicate and branching authorization logic.

## ADR DB-002: Evidence as an Interface, Not an Entity
**Context:** The architecture requires preserving provenance (which file, start/end lines). Should `Evidence` be a standalone table linked via polymorphic keys, or just columns on the respective tables?
**Decision:** `Evidence` will NOT be a separate table. Instead, it will be represented as a set of standard provenance columns (`file_path`, `start_line`, `end_line`) directly on the `Symbol`, `CodeChunk`, and `Citation` tables.
**Reason:** 
- Creating a separate `Evidence` table with polymorphic foreign keys adds unnecessary JOIN overhead for every query.
- Provenance is an intrinsic property of a parsed code artifact (Symbol/CodeChunk).
**Consequences:** Simplifies queries for RAG context building. A `Citation` can simply store the exact file path and line numbers it references.

## ADR DB-003: Embeddings as a Separate Entity, Bound to CodeChunks
**Context:** Should embeddings be a `vector` column on `CodeChunk` or a separate `Embedding` table? Can symbols be embedded?
**Decision:** Embeddings will be stored in a separate `Embedding` table with a foreign key strictly to `CodeChunk` for the MVP.
**Reason:** 
- The MVP RAG retrieval unit is `CodeChunk`.
- A separate table allows storing embeddings for multiple models simultaneously or regenerating embeddings asynchronously without altering the `CodeChunk` table schema.
- We remove polymorphic ambiguity by only allowing `code_chunk_id` for now. Symbol embeddings are deferred to a future extension if required.
**Consequences:** Requires an extra JOIN during vector search, but provides clear relational boundaries and flexibility for embedding model migrations.

## ADR DB-004: Analysis Results Storage and Uniqueness
**Context:** The Analysis Engine produces Technology Stack, Statistics, Architecture, and Overviews. 
**Decision:** Store deterministic analysis results in a generic `AnalysisResult` table using a `JSONB` payload, rather than creating separate tables for `Technology`, `Statistic`, etc. Enforce `UNIQUE(repository_version_id, analysis_type)`.
**Reason:**
- The shape of these results is flexible and highly variable.
- PostgreSQL `JSONB` is highly performant and queryable.
- Reduces schema bloat.
- The unique constraint guarantees one canonical result per analysis type for a given repository version.
**Consequences:** The application must enforce schema validation for the JSONB content using Pydantic models in Python.

## ADR DB-005: Split Relationship Models
**Context:** The system needs to represent relationships like CALLS, REFERENCES (symbol-to-symbol) and IMPORTS, DEPENDS_ON (file-to-file).
**Decision:** Use two separate relationship tables: `SymbolRelationship` and `FileRelationship`.
**Reason:**
- Avoids a generic polymorphic design (`source_type`, `source_id`).
- Prioritizes relational clarity and SQLAlchemy simplicity.
- Foreign keys can strictly point to `Symbol` or `File`.
**Consequences:** We will query `SymbolRelationship` when traversing the code architecture and `FileRelationship` when traversing module dependencies.

## ADR DB-006: Deletion and Cascading Strategy
**Context:** If a repository is deleted, or a new version is indexed, what happens to the old data?
**Decision:** Use strict `ON DELETE CASCADE` from `RepositoryVersion` down to `File`, `Symbol`, `CodeChunk`, `SymbolRelationship`, `FileRelationship`, and `Embedding`.
**Reason:** 
- Code intelligence data is entirely derived from the `RepositoryVersion`. If the version is deleted, its derived data must be purged to prevent database bloat and orphaned records.
**Consequences:** Deleting a `RepositoryVersion` may take time if it has millions of rows. We may need to delete old versions in a background task rather than blocking an API request.
