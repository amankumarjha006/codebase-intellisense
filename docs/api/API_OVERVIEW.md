# Codebase Intelligence API Overview

This document serves as the master specification for the Codebase Intelligence REST API MVP. 

## 1. Complete Endpoint List & Grouping

**AUTH**
- `GET /api/v1/auth/github`
- `GET /api/v1/auth/github/callback`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`

**REPOSITORIES**
- `GET /api/v1/repositories`
- `POST /api/v1/repositories`
- `GET /api/v1/repositories/{repository_id}`
- `POST /api/v1/repositories/{repository_id}/analyze`
- `GET /api/v1/repositories/{repository_id}/versions`
- `GET /api/v1/repositories/{repository_id}/versions/active`
- `GET /api/v1/repositories/{repository_id}/overview`
- `GET /api/v1/repositories/{repository_id}/technology-stack`
- `GET /api/v1/repositories/{repository_id}/architecture`
- `GET /api/v1/repositories/{repository_id}/files`
- `GET /api/v1/repositories/{repository_id}/files/{file_path:path}`
- `POST /api/v1/repositories/{repository_id}/search`
- `POST /api/v1/repositories/{repository_id}/chat`
- `GET /api/v1/repositories/{repository_id}/conversations`

**CONVERSATIONS**
- `GET /api/v1/conversations/{conversation_id}`
- `GET /api/v1/conversations/{conversation_id}/messages`

**JOBS**
- `GET /api/v1/jobs/{job_id}`

## 2. API Design Principles
- **Base Path**: `/api/v1`
- **JSON Format**: All requests and responses use `application/json`.
- **Status Codes**: Strict adherence to semantic HTTP status codes.
- **Pydantic**: Schemas are designed to map 1:1 with standard Pydantic models.

## 3. Authentication Strategy
The API uses session-based or HTTP-only JWT cookie authentication initialized via a GitHub App user authorization flow.
- The Next.js frontend calls `GET /api/v1/auth/github`, which redirects to GitHub.
- GitHub redirects to `GET /api/v1/auth/github/callback`.
- FastAPI handles the code exchange, links the `GithubAccount` and `GithubInstallation` to a `User` entity, sets an HTTP-only secure authentication cookie, and redirects back to the Next.js frontend.
- The frontend calls `GET /api/v1/auth/me` to read the user state.
- **Security Boundary**: The GitHub App Client ID, Client Secret, and installation access tokens remain strictly server-side. GitHub access credentials are never returned to the frontend. The frontend receives only the application's authenticated session state.

## 4. Authorization Strategy
Authorization is strictly enforced by the backend on every repository-scoped endpoint.
- Endpoint middleware extracts `repository_id` from the path.
- The database enforces authorization using the `UserRepository` mapping table: `Authenticated User -> UserRepository -> Repository`. 
- This path guarantees correct access controls regardless of whether the repository was discovered via a GitHub App installation or submitted directly as a public URL.
- If the relationship does not exist, a `404 Not Found` or `403 Forbidden` is returned immediately.
- The backend never trusts a `repository_id` simply because it was sent by the frontend.
- Job access must also be checked through the repository associated with the job.
- Conversation access must verify the authenticated user owns the conversation.

## 5. Pagination Strategy
Endpoints expected to return large lists (e.g., `files`, `repositories`, `conversations`) will use Offset-Limit pagination.
- **Convention**: Query parameters `?page=1&limit=50`.
- **Response Shape**: 
```json
{
  "items": [...],
  "total": 120,
  "page": 1,
  "limit": 50,
  "has_more": true
}
```
Endpoints where data is small (e.g., repository versions) will not be paginated for the MVP.

## 6. Error Contract
All API errors return a standard JSON structure with appropriate HTTP status codes (400, 401, 403, 404, 409, 422, 429, 500, 502, 503). Internal stack traces, database errors, or GitHub tokens are never exposed.

```json
{
  "error": {
    "code": "REPOSITORY_NOT_FOUND",
    "message": "The requested repository could not be found."
  }
}
```

## 7. API Flow Diagram

```mermaid
flowchart TD
    User --> NextJS[Next.js Client]
    NextJS --> AuthAPI[/api/v1/auth/]
    AuthAPI --> GitHubApp[GitHub App]
    
    NextJS --> ReposAPI[/api/v1/repositories]
    ReposAPI --> GitHubService[GitHub Service]
    
    NextJS --> AnalyzeAPI[/api/v1/repositories/{id}/analyze]
    AnalyzeAPI --> Redis[Redis Queue]
    Redis --> Worker[Background Worker]
    
    NextJS --> KnowledgeAPI[Overview / Stack / Architecture]
    KnowledgeAPI --> DB[(PostgreSQL)]
    
    NextJS --> FilesAPI[/api/v1/repositories/{id}/files]
    FilesAPI --> DB
    
    NextJS --> SearchAPI[/api/v1/repositories/{id}/search]
    SearchAPI --> Retrieval[Hybrid Retrieval]
    
    NextJS --> ChatAPI[/api/v1/repositories/{id}/chat]
    ChatAPI --> Retrieval
    Retrieval --> Builder[Context Builder]
    Builder --> Gemini[Gemini API]
```

## 8. Database Consistency Review
- **Authentication**: `auth/me` relies on `users` and `github_accounts`.
- **Repositories**: `repositories` and `user_repositories` cleanly support POSTing URLs and listing authorized repos while respecting explicit access mapping.
- **Versions**: `repository_versions` supports the `versions/active` endpoint.
- **Indexing**: `index_jobs` tracks statuses for `jobs/{id}`.
- **Files**: `files` maps directly to file browsing.
- **Search**: Hybrid search utilizes `code_chunks`, `embeddings`, and `symbols`.
- **Analysis**: `analysis_results` (JSONB) backs the Tech Stack, Overview, and Architecture endpoints without redundant schemas.
- **Chat**: `conversations`, `messages`, and `citations` support the multi-turn chat and provenance UI perfectly.

## 9. Architecture Consistency Review
- **Isolation**: The API endpoints (FastAPI) merely insert jobs into Redis and return 202 Accepted. They do not block on Tree-sitter or Gemini.
- **Knowledge Layer**: RAG and Analysis endpoints strictly query the *active* `RepositoryVersion`, preventing version bleed.
- **Gemini Context**: The `/chat` endpoint performs hybrid retrieval and passes a strictly constructed context block to Gemini. Gemini does not interact with the repository directly.
- **GitHub Credentials**: Remain securely server-side.
- **MVP Boundaries**: There are no endpoints for webhooks, writing to repositories, or orchestrating multi-agent tasks.

## 10. Remaining Unresolved API Decisions
1. **Exact frontend callback redirect route**: The Next.js route `/api/v1/auth/github/callback` redirects to (e.g., `/dashboard`).
2. **Future job streaming/SSE vs polling**: Currently HTTP polling; SSE is deferred.
3. **Future chat streaming**: The `/chat` endpoint uses standard JSON response for MVP. SSE/WebSockets are deferred.
