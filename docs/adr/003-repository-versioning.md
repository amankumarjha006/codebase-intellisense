# ADR 003: Repository Versioning and Snapshot Model

## Context
Code repositories are dynamic. If the platform extracts knowledge (files, symbols, chunks, embeddings) from a repository, that knowledge is tied to a specific point in time. If the repository is updated and the AI is queried, the system must know which version of the repository the AI is referencing to ensure accurate, grounded answers and correct citations.

## Decision
We will introduce a **Repository Version / Snapshot** model in the architecture. Instead of linking parsed knowledge directly to the `Repository` entity, we will link it to a `RepositoryVersion` entity.

## Reason
- **Provenance and Accuracy**: Ensures that all AI answers, code viewer references, and derived insights (chunks, symbols) are bound to the exact commit SHA that was analyzed.
- **Re-indexing Support**: Allows the system to ingest a new version of the repository asynchronously without immediately destroying the old knowledge base, enabling atomic swaps or version comparison in the future.
- **Data Integrity**: Prevents corrupted state where some chunks belong to an old commit and some belong to a new commit during an update.

## Alternatives Considered
- **Direct Linkage (Knowledge -> Repository)**: Rejected because it makes re-indexing fragile and destroys historical context.
- **Git Tree Integration**: Rejected for MVP as querying Git trees directly on every request is slow; extracting into our own snapshot model is faster for RAG and analysis.

## Consequences
- The knowledge layer hierarchy becomes: `Repository -> RepositoryVersion -> Files -> Symbols/Chunks/Relationships`.
- The database schema must reflect this versioning.
- Queries for RAG and analysis must be scoped to the "active" or latest successful `RepositoryVersion`.
