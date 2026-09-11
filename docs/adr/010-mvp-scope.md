# ADR 010: MVP Scope

## Context
Codebase Intelligence is an ambitious project with a massive potential feature space. To deliver a working product without getting bogged down in complexity, we must strictly define what is in and out of scope for the Minimum Viable Product (MVP).

## Decision
The MVP scope is strictly bounded to read-only repository analysis and grounded AI Chat. Features involving automation, multi-repository reasoning, and real-time synchronization are deferred to future phases.

## MVP Scope (In Scope)
- GitHub App authentication (read-only access).
- Fetching and listing accessible repositories.
- Triggering analysis via GitHub repository selection or public URL.
- Asynchronous repository indexing (Tree-sitter, symbols, chunks, embeddings).
- Repository version tracking (snapshotting).
- Postgres + pgvector + Redis infrastructure.
- Hybrid search (Vector + Keyword).
- Deterministic extraction of Technology Stack and Architecture.
- AI Codebase Chat with RAG and Citations.
- Frontend visualization of architecture, chat, and a code viewer.
- Basic evaluation frameworks.

## Future Scope (Out of Scope for MVP)
- Incremental indexing optimization (only re-indexing changed files).
- GitHub Webhooks for automatic re-indexing on push.
- Automated code modifications or Pull Request generation.
- Autonomous coding agents.
- Multi-repository context and reasoning.
- Team collaboration and shared chats.
- Advanced reranking models (e.g., Cohere Rerank) – MVP will use simple Reciprocal Rank Fusion.
- Dedicated graph databases (Neo4j) or advanced orchestration frameworks (LangChain/LangGraph).

## Reason
- **Focus**: Prevents scope creep and guarantees delivery of the core value proposition: understanding a codebase.
- **Complexity Management**: Keeps the architecture simple enough for a small team to implement and maintain.
