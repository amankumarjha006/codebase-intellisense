---
name: testing-quality
description: Maintains correctness and reliability through unit, integration, API, indexing, retrieval, security, and end-to-end tests. Use when implementing features, fixing bugs, refactoring, or preparing releases.
---

# Testing and Quality Skill

## Goal

Prioritize correctness and reliability over merely making code execute.

## Backend Tests

Test:

- API endpoints
- Authentication
- Repository authorization
- Services
- Database operations
- Error handling
- Indexing states

## Indexer Tests

Test:

- File filtering
- Language detection
- Parsing
- Symbol extraction
- Relationship extraction
- Chunking
- Metadata
- Re-indexing behavior

Use representative repository fixtures.

## Search Tests

Test:

- Keyword retrieval
- Vector retrieval
- Symbol retrieval
- Path retrieval
- Hybrid ranking
- Empty results
- Poor queries

## RAG Tests

Test:

- Retrieval relevance
- Citation correctness
- Grounded answers
- Unsupported claims
- Missing evidence
- Prompt injection from repository content

## Security Tests

Verify:

- Users cannot access unauthorized repositories.
- GitHub credentials are not exposed.
- Secrets are not returned through APIs.
- Repository content cannot override AI system instructions.

## Frontend Tests

Test:

- Repository selection
- Analysis progress
- Search
- Chat
- Citation navigation
- Code viewer
- Error states

## Regression Rule

When fixing a bug:

1. Reproduce it.
2. Add a regression test.
3. Fix it.
4. Run relevant tests.
5. Confirm unrelated functionality remains intact.

## Quality Rule

Do not mark a feature complete merely because the happy path works.