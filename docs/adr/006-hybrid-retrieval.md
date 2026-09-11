# ADR 006: Hybrid Retrieval

## Context
For AI Chat and Q&A, the system must retrieve relevant code chunks and context based on user queries. Relying purely on semantic vector search (embeddings) often fails for codebase retrieval because vector models struggle with exact keyword matches (e.g., finding a specific class name, variable, or error code).

## Decision
We will implement a **Hybrid Retrieval** strategy for the RAG pipeline.

## Reason
- **Accuracy**: Codebase questions often require finding exact symbols or file paths, which lexical/keyword search excels at. Semantic search is better for conceptual questions ("How does authentication work?"). Combining them yields the best of both worlds.
- **Comprehensive Context**: The hybrid approach will combine:
  1. Vector/semantic search (via `pgvector`)
  2. Keyword/full-text search (via PostgreSQL full-text search)
  3. Symbol and File/path search
  4. Metadata and relationship filtering
- **State-of-the-Art**: Hybrid retrieval with score fusion is the industry standard for code-based RAG.

## Alternatives Considered
- **Pure Vector Search**: Rejected because it performs poorly on exact identifier matching and structural queries.
- **Pure Keyword Search**: Rejected because it cannot handle semantic queries or natural language intent well.

## Consequences
- Retrieval latency will be slightly higher as multiple search strategies execute.
- Requires implementing a score fusion mechanism (like Reciprocal Rank Fusion - RRF) to combine results from disparate scoring systems.
- PostgreSQL will be utilized for both vector queries and full-text indexes.
