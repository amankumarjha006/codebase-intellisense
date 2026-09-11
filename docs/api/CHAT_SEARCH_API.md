# Chat & Search API Contracts

All endpoints here are nested under a specific repository and require authorization verifying the user can access that repository via `User -> UserRepository -> Repository`.

## 1. Code Search (Hybrid Retrieval)
**Endpoint:** `POST /api/v1/repositories/{repository_id}/search`
**Purpose:** Executes a hybrid search (keyword + semantic + symbol) against a specific RepositoryVersion.
**Auth Required:** Yes
**Request:**
```json
{
  "query": "authentication flow",
  "repository_version_id": "optional-version-uuid"
}
```
*Note on Versioning: If `repository_version_id` is omitted, the backend uses the active successful RepositoryVersion. If provided, the backend verifies that the version belongs to the requested repository and the user has access.*
**Response (200 OK):**
```json
{
  "results": [
    {
      "id": "code-chunk-uuid",
      "file_path": "src/auth.ts",
      "start_line": 15,
      "end_line": 40,
      "snippet": "export function login() { ... }",
      "score": 0.95
    }
  ],
  "repository_version_id": "version-uuid"
}
```

## 2. AI Codebase Chat
**Endpoint:** `POST /api/v1/repositories/{repository_id}/chat`
**Purpose:** Answers questions grounded in the repository context using RAG and Gemini.
**Auth Required:** Yes
**Request:**
```json
{
  "message": "How does the login flow work?",
  "conversation_id": "optional-conv-uuid",
  "repository_version_id": "optional-version-uuid"
}
```
*Note on Flow: If `conversation_id` is omitted, a new conversation is automatically created. If `repository_version_id` is omitted, the active successful version is used.*
**Response (200 OK):**
```json
{
  "conversation_id": "conv-uuid",
  "message_id": "msg-uuid",
  "repository_version_id": "version-uuid",
  "role": "assistant",
  "content": "The login flow uses GitHub App auth. Here is the implementation...",
  "citations": [
    {
      "code_chunk_id": "chunk-uuid",
      "file_path": "src/auth/service.ts",
      "start_line": 42,
      "end_line": 67
    }
  ]
}
```
*Note: This is a standard JSON request/response endpoint for the MVP. Streaming (SSE) is deferred to future enhancements.*

## 3. List Conversations
**Endpoint:** `GET /api/v1/repositories/{repository_id}/conversations`
**Purpose:** Returns chat history sessions for the user and repository.
**Auth Required:** Yes (Must own the conversation).
**Query Parameters:** `page`, `limit`
**Response (200 OK):** Paginated list of Conversation objects (`id`, `title`, `created_at`).

## 4. Get Conversation
**Endpoint:** `GET /api/v1/conversations/{conversation_id}`
**Purpose:** Returns conversation metadata.
**Auth Required:** Yes (Must own the conversation).
**Response (200 OK):**
```json
{
  "id": "conv-uuid",
  "repository_id": "repo-uuid",
  "repository_version_id": "version-uuid",
  "title": "Authentication Flow",
  "created_at": "2026-09-11T12:00:00Z"
}
```

## 5. Get Conversation Messages
**Endpoint:** `GET /api/v1/conversations/{conversation_id}/messages`
**Purpose:** Returns the full message history (including citations) for a chat session.
**Auth Required:** Yes (Must own the conversation).
**Query Parameters:** `page`, `limit`
**Response (200 OK):** Paginated list of Message objects.
```json
{
  "items": [
    {
      "id": "msg-1",
      "role": "user",
      "content": "How does login work?",
      "created_at": "2026-09-11T12:01:00Z"
    },
    {
      "id": "msg-2",
      "role": "assistant",
      "content": "It uses OAuth...",
      "created_at": "2026-09-11T12:01:05Z",
      "citations": [
        {
          "file_path": "src/auth/service.ts",
          "start_line": 42,
          "end_line": 67
        }
      ]
    }
  ],
  "total": 2,
  "page": 1,
  "limit": 50,
  "has_more": false
}
```
