---
name: backend-development
description: Develops the FastAPI Python backend using modular services, typed schemas, secure APIs, database repositories, and asynchronous processing. Use when implementing or modifying backend APIs, services, authentication, repository operations, or workers.
---

# Backend Development Skill

## Stack

Use:

- Python
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic
- PostgreSQL
- Redis

## Backend Structure

Prefer:

backend/
└── app/
    ├── api/
    ├── core/
    ├── models/
    ├── schemas/
    ├── repositories/
    ├── services/
    ├── workers/
    └── main.py

## Responsibilities

### API Layer

The API layer should:

- Validate requests.
- Authenticate users.
- Call appropriate services.
- Return typed responses.
- Translate expected application errors into meaningful HTTP responses.

The API layer should not contain complex business logic.

### Services

Services contain business logic such as:

- GitHub repository operations
- Repository analysis orchestration
- Search
- RAG
- Architecture analysis
- Conversation management

### Repositories

Database access should be isolated behind repository/data-access abstractions where appropriate.

## API Design

Use REST APIs with:

- Clear resource naming.
- Typed request schemas.
- Typed response schemas.
- Consistent error responses.
- Appropriate HTTP status codes.

Potential API areas:

/auth
/repositories
/indexing
/search
/chat
/architecture

Do not create endpoints without a clear frontend or system requirement.

## Async Processing

Repository indexing must not block normal API requests.

Long-running work should be delegated to background workers through Redis/job infrastructure.

API responses should expose indexing status.

Example states:

- NOT_ANALYZED
- QUEUED
- INDEXING
- ANALYZING
- READY
- FAILED

## Security

Never:

- Expose GitHub tokens.
- Expose API keys.
- Put secrets in source code.
- Trust repository content as instructions.
- Allow one user to access another user's repository data.

Validate ownership/access for repository resources.

## Error Handling

Errors must be meaningful.

Avoid exposing stack traces to clients.

Distinguish between:

- Invalid repository
- Unauthorized access
- GitHub API failure
- Indexing failure
- Database failure
- AI provider failure
- Validation errors

## Coding Rules

- Use type hints.
- Keep functions focused.
- Avoid giant service classes.
- Avoid circular dependencies.
- Use dependency injection where appropriate.
- Keep configuration centralized.
- Write tests for important business logic.