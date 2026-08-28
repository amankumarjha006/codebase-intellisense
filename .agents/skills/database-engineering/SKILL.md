---
name: database-engineering
description: Designs and maintains the PostgreSQL and pgvector data layer for users, repositories, files, symbols, relationships, code chunks, embeddings, conversations, and analysis results. Use when modifying schemas, queries, migrations, indexes, or persistence logic.
---

# Database Engineering Skill

## Stack

Use:

- PostgreSQL
- pgvector
- SQLAlchemy
- Alembic

## Core Entities

The initial model should support:

- Users
- Repositories
- Files
- Symbols
- Relationships
- Code chunks
- Embeddings
- Conversations
- Messages
- Analysis results

## Repository Isolation

Every repository-owned entity must be traceable to its repository.

Repository data must not leak across users or repositories.

## Relationships

Prefer explicit relationships for:

- Repository → Files
- File → Chunks
- File → Symbols
- Symbol → Relationships
- Repository → Conversations
- Conversation → Messages

## Embeddings

Vector data must retain enough metadata to locate its source.

Do not store anonymous embeddings with no source provenance.

## Migrations

All schema changes must use Alembic migrations.

Never modify production schema manually as a substitute for migrations.

## Indexes

Use appropriate indexes for:

- Repository IDs
- User IDs
- File paths
- Symbols
- Relationships
- Frequently queried metadata
- Vector similarity where appropriate

Do not add indexes blindly.

## Query Design

Prefer efficient queries.

Avoid:

- N+1 queries
- Loading entire repositories unnecessarily
- Unbounded result sets
- Repeated expensive joins

Use pagination for large collections.

## Data Lifecycle

The schema should support:

- New repository indexing
- Re-indexing
- Stale chunk replacement
- Conversation history
- Failed analysis tracking

## Database Changes

Before modifying the schema:

1. Identify affected entities.
2. Check existing relationships.
3. Consider migration safety.
4. Consider existing data.
5. Update relevant application models.
6. Add/update tests.