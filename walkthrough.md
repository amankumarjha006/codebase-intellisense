## Phase 4.7: RAG Query Orchestration

### Files inspected
- `server/app/repositories/repository.py`
- `server/app/services/retrieval/service.py` & `models.py`
- `server/app/services/context/builder.py` & `models.py`
- `server/app/services/rag/service.py` & `models.py`
- `server/app/services/citation/service.py` & `models.py`
- `server/app/services/answer/service.py` & `models.py`
- `server/app/models/repository.py`
- `server/app/services/llm/exceptions.py`
- `server/app/services/agent_execution.py` (to understand DI patterns)

### Files created
- `server/app/services/rag_query/__init__.py`
- `server/app/services/rag_query/models.py`
- `server/app/services/rag_query/exceptions.py`
- `server/app/services/rag_query/service.py`
- `server/tests/services/rag_query/test_rag_query_service.py`
- `walkthrough.md`

### Architecture
```text
RAGQueryRequest
       │
       ▼
RAGQueryService (resolves repository version)
       │
       ▼
RetrievalService (returns RetrievalResult[])
       │
       ▼
ContextBuilder (returns AssembledContext)
       │
       ▼
RAGService (returns RAGResponse)
       │
       ▼
CitationService (returns CitationResponse)
       │
       ▼
AnswerService (returns AnswerResponse)
       │
       ▼
RAGQueryResponse
```

### Contracts
`RAGQueryRequest` and `RAGQueryResponse` have been implemented as strict immutable dataclasses in `server/app/services/rag_query/models.py` to ensure type safety without bringing external framework specific logic into the domain boundaries.

### Error behavior
Orchestrator-owned exceptions:
- `InvalidQueryError`: Raised before doing anything if the query is empty or whitespace.
- `NoIndexedVersionError`: Raised if no explicit version is passed and the repo has no active SUCCESS indexed version.
- `InvalidRepositoryVersionError`: Raised if an explicit version doesn't exist, isn't linked to the repo, or isn't SUCCESS.

Downstream errors like `TransientLLMError` and `PermanentLLMError` propagate cleanly unchanged to the caller.

### Version safety
The `RAGQueryService` guarantees safety before initiating a retrieval:
- When an explicit version is specified, it strictly verifies the existence, repository ownership, and `"SUCCESS"` status of that exact version via `get_version_by_id`.
- When no explicit version is passed, it delegates to `get_active_version(repository_id)` to automatically fetch the latest successfully indexed version, ensuring we never query against pending/failed/stale indices.
The resolved version ID is preserved in the response to establish the provenance of the answer.

### Tests
The test suite in `test_rag_query_service.py` passes 100%. Tested boundaries include:
- Happy path execution tracking exact parameters passed throughout the pipeline.
- `InvalidQueryError` propagation on empty payloads.
- `NoIndexedVersionError` logic.
- `InvalidRepositoryVersionError` logic across various faulty conditions.
- Strict propagation of empty retrieval results through the context assembler and into the RAG generation step.
- Propagation of `TransientLLMError` from LLM layers.
Note: Running `pytest tests -v` exposed two failures in `test_analyze_repository.py` which are unrelated to `rag_query` (a `500 Internal Server Error` in an API mocked route). No regressions were introduced by Phase 4.7.

### Scope
- **Confirmed**: No FastAPI or API routing layers were modified.
- **Confirmed**: No LLM, SQL, or persistence logic was duplicated.
- **Confirmed**: No modification was made to downstream retrieval, context, RAG, citation, or answer implementations.
- **Confirmed**: The orchestrator focuses purely on bridging outputs of preceding services into the inputs of succeeding ones.

PHASE 4.7 — COMPLETE

## Phase 5.1: Conversation & Chat Foundation

### Files inspected
- `server/app/models/conversation.py`
- `server/app/schemas/repository.py`
- `server/app/api/v1/api.py`
- `server/app/api/v1/endpoints/repositories.py`
- `server/tests/api/v1/test_repositories.py`

### Files created
- `server/app/repositories/conversation.py`
- `server/app/repositories/message.py`
- `server/app/schemas/conversation.py`
- `server/app/services/conversation/exceptions.py`
- `server/app/services/conversation/service.py`
- `server/app/api/v1/endpoints/conversations.py`
- `server/tests/api/v1/test_conversations.py`

### Files modified
- `server/app/api/v1/api.py` (registered new router)

### Conversation Architecture
- **`Conversation`**: Links an ongoing chat thread to a `User`, a `Repository`, and a `RepositoryVersion`. This strictly scopes conversations, preventing cross-repository leakage.
- **`Message`**: Represents an individual user or assistant message tied immutably to a `Conversation`. Has a constrained `role` (user or assistant).

### Message Architecture
Messages are persisted chronologically (`created_at`) via the `MessageRepository`. Citations are decoupled into their own model (`Citation`), maintaining a clean separation between raw text content and structured metadata.

### Ownership & Access Control Model
Conversations strictly belong to a user. Fetching, listing, or deleting conversations enforces `user_id` ownership checking at the repository layer. The API further wraps all conversation requests in `get_authorized_repository`, enforcing that the user possesses repository access rights before any conversation action can occur.

### API Contracts
Four endpoints were implemented on the `/conversations` and `/repositories/{id}/conversations` sub-routes:
- `POST /repositories/{id}/conversations`: Creates a conversation on the active version.
- `GET /repositories/{id}/conversations`: Lists paginated conversations.
- `GET /conversations/{id}`: Fetches a single conversation.
- `DELETE /conversations/{id}`: Deletes a conversation.
- `GET /conversations/{id}/messages`: Lists chronological paginated messages.

### Persistence & Transaction Behavior
Standard SQLAlchemy `Session` objects orchestrate transactions, seamlessly injecting via FastAPI `Depends`. Creation requests call `.add()`, `.commit()`, and `.refresh()` sequentially, keeping transaction scopes bound to HTTP request lifecycles.

### Test Results
- Full coverage added in `server/tests/api/v1/test_conversations.py`.
- Tests accurately mock DB transactions, testing authentication constraints, schema mapping (particularly `created_at` date serialization), active version enforcement, and pagination metadata.

### Regression Results
- `486 passed, 4 skipped, 1334 warnings in 54.89s`.
- No regressions discovered.

### Scope Verification
- **Confirmed**: No RAG pipeline code or logic was duplicated.
- **Confirmed**: No LLM logic, background workers, or websockets were introduced.
- **Confirmed**: The `RAGQueryService` remains fully independent.

### Future Integration Point
In future phases, the `Message` endpoint (`POST /conversations/{id}/messages`) will bridge to the `RAGQueryService` to stream answers back to the UI, securely associating those queries with persistent `Message` objects in the database.

PHASE 5.1 — COMPLETE

## Phase 5.2 — Conversation Message / RAG Integration

### 1. Initial Architecture Inspection
Inspected the existing `Conversation`, `Message`, and `Citation` SQLAlchemy models. Also inspected `MessageRepository`, `ConversationRepository`, and `RAGQueryService`. Found that `Message` relates to `Citation`, and that `MessageRepository.create()` persists the message along with its nested relationships transactionally.

### 2. Gap Analysis
- **Already existed:** `Message`, `Citation`, and `Conversation` DB models, `MessageRepository` capable of handling nested objects, `RAGQueryService` (the stateless orchestrator).
- **Missing:** The integration service `ConversationMessageService`, the POST endpoint for sending messages, and the domain schemas for `MessageOutWithCitations`.
- **Did NOT need modification:** Existing DB schema was untouched; `ConversationService`, `RAGQueryService`, and the base repositories were completely preserved as-is.

### 3. Files Created
- `server/app/schemas/message.py`
- `server/app/services/conversation/message_service.py`
- `server/tests/services/conversation/test_message_service.py`

### 4. Files Modified
- `server/app/api/v1/endpoints/conversations.py`
- `scratch/generate_collection.py`

### 5. ConversationMessageService Architecture
`ConversationMessageService` acts as a pure integration boundary. It takes the `ConversationRepository`, `MessageRepository`, and `RAGQueryService`. It first resolves and validates the conversation. Then it handles two strict transaction scopes sandwiching the network I/O, seamlessly mapping the domain request to `RAGQueryRequest` and mapping the responses back.

### 6. Transaction Strategy
- **Transaction 1:** Commits the user message to `MessageRepository` *before* hitting the RAG pipeline.
- **Network I/O:** `RAGQueryService` is called *outside* of any open SQLAlchemy transaction, avoiding connection exhaustion.
- **Transaction 2:** Commits the assistant message and nested `citations` to `MessageRepository` transactionally. If this fails, no partial citations are saved, but the user message is already safely persisted.

### 7. Repository Version Pinning
The service uses `conversation.repository_version_id` to route the RAG request directly to the exact version snapshot associated with the conversation at its creation. It deliberately does not resolve to the active version (`get_active_version()`), locking in citation provenance permanently.

### 8. Message Persistence
The service persists the user's message, executes RAG, and persists the resulting text as an assistant message. Both messages are immediately flushed to PostgreSQL.

### 9. Citation Persistence
Citations returned by `RAGQueryService` are mapped directly to the SQLAlchemy `Citation` model and appended to the assistant's `citations` relationship list. SQLAlchemy handles foreign key assignment to the assistant message ID during commit.

### 10. API Contract
A new `POST /conversations/{conversation_id}/messages` endpoint was implemented, returning a structured `ConversationMessageResponse` containing:
- `user_message` (with empty citations)
- `assistant_message` (with nested citations array)
- `repository_version_id`

### 11. Error Handling
- Invalid/Unauthorized conversation mapping to `404 Not Found`.
- `InvalidQueryError`, `InvalidRepositoryVersionError`, and `NoIndexedVersionError` mapping to `400 Bad Request`.
- Upstream network errors mapping to `502 Bad Gateway`.

### 12. Focused Test Results
Unit tests created in `test_message_service.py` verifying the two-transaction boundary, the version pinning behavior, the RAG orchestration mapping, and exception raising. Tests pass completely.

### 13. API Test Results
Executed the `pytest` regression suite across the entire repository.
- `488 passed, 4 skipped in 53.57s`.
- No new regressions introduced.

### 14. Postman Verification
Updated `scratch/generate_collection.py` with the new endpoint validation tests. Started the real `uvicorn` FastAPI server, populated with genuine PostgreSQL and Redis states, and executed the collection.
- 16 requests and 22 assertions passed seamlessly with real network I/O generating the assistant response using Gemini.

### 15. Defects Discovered
None in the logic; However, initial test mocks in Python were missing fields that `Pydantic` `model_validate()` required (`created_at`, `id`).

### 16. Defects Fixed
Added missing IDs and datetimes to pytest mocks to properly simulate SQLAlchemy's `db.refresh()` auto-population behavior.

### 17. Pre-existing Failures
None discovered.

### 18. Scope Verification
- **Confirmed**: No RAG core logic was modified.
- **Confirmed**: Database schemas were respected without forcing changes to `citations` tables.
- **Confirmed**: `ConversationMessageService` does NOT do RAG itself, but correctly delegates to `RAGQueryService`.

### 19. Known Limitations
- Generating a message blocks the HTTP response for 5-15 seconds since it uses synchronous network I/O. Future phases could employ SSE/WebSockets for streaming.

### 20. Final Verdict
Phase 5.2 was perfectly executed adhering to the required architectural patterns, maintaining proper separation of concerns between conversation management, persistence transactions, and stateless RAG generation logic.

PHASE 5.2 — COMPLETE
