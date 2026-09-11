# ADR 001: PostgreSQL and pgvector as Primary Data Store

## Context
Codebase Intelligence requires storing structured relational data (users, repositories, file metadata, relationships) alongside high-dimensional vector embeddings for semantic search (RAG). Introducing multiple database systems (e.g., PostgreSQL for relational data + Pinecone or Weaviate for vectors) introduces operational complexity, data synchronization challenges, and overhead for local development and self-hosting.

## Decision
We will use **PostgreSQL** as the primary data store for all relational data and the **pgvector** extension for storing and querying vector embeddings.

## Reason
- **Simplicity**: Consolidates relational data and vector embeddings into a single system, eliminating the need for dual-write data synchronization.
- **ACID Compliance**: Provides strong consistency guarantees when updating repository data and its associated embeddings simultaneously.
- **MVP Focus**: Avoids the premature optimization and complexity of managing a dedicated vector database before the dataset scale warrants it.
- **Ecosystem**: Integrates seamlessly with SQLAlchemy and Alembic in the FastAPI backend.

## Alternatives Considered
- **Dedicated Vector Databases (Pinecone, Weaviate, Qdrant, Milvus)**: Rejected for MVP due to increased operational overhead, cost, and complexity of maintaining consistency with the primary relational database. 

## Consequences
- Requires `pgvector` extension to be installed in the PostgreSQL instance (readily available in modern Docker images like `pgvector/pgvector`).
- We will start with exact nearest neighbor search (L2 distance, Cosine similarity) and only introduce vector indexes (HNSW, IVFFlat) when performance degrades at scale, as indexing requires a sufficient amount of data to be effective.
