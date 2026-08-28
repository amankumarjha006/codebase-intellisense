---
name: project-architecture
description: Maintains and enforces the approved architecture, boundaries, design decisions, and implementation structure of the Codebase Intelligence platform. Use when planning features, making architectural decisions, adding services, changing project structure, or modifying cross-cutting components.
---

# Project Architecture Skill

## Purpose

Keep the Codebase Intelligence project architecturally consistent and prevent uncontrolled complexity, duplicated systems, and unnecessary technology changes.

This project is an AI-powered GitHub repository analysis platform.

The current MVP allows a user to:

1. Authenticate with GitHub.
2. Fetch repositories accessible to the user.
3. Select a repository for analysis.
4. Analyze a public GitHub repository using a repository URL.
5. Index and understand the repository.
6. Display the project's technology stack.
7. Generate a project/repository overview.
8. Generate and display repository architecture.
9. Search the repository.
10. Ask questions through AI chat using repository-grounded RAG.
11. Provide source/file/line references for AI answers.
12. View referenced source code.

## Approved High-Level Architecture

The system consists of:

- Next.js + TypeScript frontend
- FastAPI + Python backend
- PostgreSQL + pgvector
- Redis
- Background workers
- GitHub API / GitHub OAuth
- Tree-sitter for source parsing
- Embedding generation
- Gemini for AI generation
- Hybrid retrieval for repository search and RAG

Primary architecture:

User
→ Next.js
→ FastAPI
→ Application Services
→ PostgreSQL / pgvector

Repository indexing:

GitHub
→ Repository Fetcher
→ File Filtering
→ Tree-sitter
→ AST / Symbol Extraction
→ Relationship Extraction
→ Code Chunking
→ Embeddings
→ PostgreSQL + pgvector

AI:

User Question
→ Query Processing
→ Hybrid Retrieval
→ Ranking
→ Context Construction
→ Gemini
→ Grounded Answer
→ Source References

## Architectural Rules

1. Do not introduce a new database without explicit architectural justification.
2. PostgreSQL is the primary persistent datastore.
3. pgvector is the initial vector-search solution.
4. Redis is used for caching and background job coordination.
5. Repository indexing should be asynchronous.
6. Tree-sitter is the primary source-code parser.
7. Do not send an entire repository directly to the LLM.
8. AI answers must be grounded in indexed repository evidence.
9. Frontend code must not contain secrets or GitHub credentials.
10. GitHub credentials and API keys must remain server-side.
11. Keep repository data isolated by user and repository.
12. Prefer modular services over large monolithic files.
13. Database changes must use migrations.
14. Do not duplicate functionality that already exists elsewhere in the system.
15. Do not introduce technologies merely because they are popular.
16. Keep MVP implementation separate from future agent/autonomous coding functionality.

## Before Making Architectural Changes

When a requested change affects multiple components:

1. Identify affected components.
2. Explain the proposed change.
3. Identify database/API implications.
4. Identify security implications.
5. Identify performance implications.
6. Check whether an existing component can support the requirement.
7. Prefer the smallest architectural change that satisfies the requirement.

Do not silently redesign unrelated parts of the system.

## MVP Boundary

The MVP includes:

- GitHub authentication
- Repository listing
- Repository selection
- Public repository URL analysis
- Repository indexing
- Technology stack detection
- Project overview
- Architecture analysis
- Architecture visualization
- Repository search
- RAG-based AI chat
- Source citations
- Code viewer
- Basic repository statistics

The MVP does NOT include:

- Autonomous coding agents
- Automatic code modification
- Pull request generation
- Autonomous refactoring
- Multi-repository reasoning
- Full autonomous impact analysis
- Team collaboration

These are future capabilities.

## Implementation Discipline

Before implementing a major feature, determine:

- Which component owns the functionality.
- What data it requires.
- What API it exposes.
- What database changes are required.
- Whether it is synchronous or asynchronous.
- How failures are handled.
- How it will be tested.

Do not implement features by scattering logic across unrelated modules.