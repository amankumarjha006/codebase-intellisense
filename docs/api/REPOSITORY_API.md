# Repository & Analysis API Contracts

All endpoints reading or modifying a specific repository (i.e. `/api/v1/repositories/{repository_id}/*`) require authorization. The backend enforces access explicitly via the `User -> UserRepository -> Repository` relationship before returning data.

## 1. List Repositories
**Endpoint:** `GET /api/v1/repositories`
**Purpose:** Lists repositories authorized for the user via the `UserRepository` mapping.
**Auth Required:** Yes
**Query Parameters:** `page`, `limit`, `search`
**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "repo-uuid",
      "owner": "fastapi",
      "name": "fastapi",
      "is_private": false,
      "created_at": "2026-09-11T12:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50,
  "has_more": false
}
```
*Note: The internal `clone_url` is NOT exposed in the frontend API response.*

## 2. Submit Public Repository URL
**Endpoint:** `POST /api/v1/repositories`
**Purpose:** Instructs the backend to track a public GitHub URL directly.
**Auth Required:** Yes
**Request:**
```json
{
  "url": "https://github.com/owner/repo"
}
```
**Response (201 Created):** Returns the Repository object (same shape as item in List Repositories).
*Flow Note: Submitting a URL creates/finds the `Repository` with `github_installation_id = NULL` and creates a `UserRepository` record associating the authenticated User with the `Repository`.*

## 3. Get Repository Details
**Endpoint:** `GET /api/v1/repositories/{repository_id}`
**Auth Required:** Yes
**Response (200 OK):**
```json
{
  "id": "repo-uuid",
  "owner": "fastapi",
  "name": "fastapi",
  "is_private": false,
  "active_version": {
    "id": "version-uuid",
    "commit_sha": "a1b2c3d4",
    "status": "SUCCESS"
  }
}
```

## 4. Analyze Repository
**Endpoint:** `POST /api/v1/repositories/{repository_id}/analyze`
**Purpose:** Triggers asynchronous indexing. Creates a RepositoryVersion and an IndexJob.
**Auth Required:** Yes
**Request:**
```json
{
  "branch": "main" // Optional
}
```
**Response (202 Accepted):**
```json
{
  "job_id": "job-uuid",
  "repository_version_id": "version-uuid",
  "status": "QUEUED",
  "message": "Analysis job queued successfully."
}
```
*Note: Fails with `409 Conflict` (INDEXING_ALREADY_IN_PROGRESS) if an active job (QUEUED, FETCHING, INDEXING, ANALYZING) already exists.*

## 5. Get Index Job Status
**Endpoint:** `GET /api/v1/jobs/{job_id}`
**Auth Required:** Yes (Must own the repository the job belongs to)
**Response (200 OK):**
```json
{
  "id": "job-uuid",
  "repository_id": "repo-uuid",
  "repository_version_id": "version-uuid",
  "status": "INDEXING",
  "started_at": "2026-09-11T12:05:00Z",
  "completed_at": null,
  "error_message": null
}
```

## 6. Get Project Overview
**Endpoint:** `GET /api/v1/repositories/{repository_id}/overview`
**Auth Required:** Yes
**Purpose:** Retrieves the deterministic OVERVIEW analysis generated for the active repository version. Does NOT regenerate on every GET.
**Response (200 OK):**
```json
{
  "analysis_type": "OVERVIEW",
  "repository_version_id": "version-uuid",
  "payload": {
    "description": "A modern, fast web framework for Python.",
    "primary_language": "Python"
  }
}
```

## 7. Get Technology Stack
**Endpoint:** `GET /api/v1/repositories/{repository_id}/technology-stack`
**Auth Required:** Yes
**Response (200 OK):**
```json
{
  "analysis_type": "TECH_STACK",
  "repository_version_id": "version-uuid",
  "payload": {
    "technologies": [
      {
        "technology": "PostgreSQL",
        "category": "Database",
        "confidence": "HIGH",
        "evidence": ["Found in docker-compose.yml"]
      }
    ]
  }
}
```

## 8. Get Architecture
**Endpoint:** `GET /api/v1/repositories/{repository_id}/architecture`
**Auth Required:** Yes
**Response (200 OK):**
```json
{
  "analysis_type": "ARCHITECTURE",
  "repository_version_id": "version-uuid",
  "payload": {
    "components": [...],
    "relationships": [...]
  }
}
```

## 9. Browse Files
**Endpoint:** `GET /api/v1/repositories/{repository_id}/files`
**Purpose:** Lists files for the active version.
**Query Parameters:** `directory`, `page`, `limit`
**Response (200 OK):** Paginated list of file objects containing `id`, `file_path`, `language`, and `size_bytes`.

## 10. Get File Contents
**Endpoint:** `GET /api/v1/repositories/{repository_id}/files/{file_path:path}`
**Purpose:** Retrieves file info for the code viewer.
**Auth Required:** Yes
**Path Validation:** The backend MUST strictly validate `file_path` against `../`, absolute paths, path traversal, escaping the indexed repository, and invalid/null paths. Resolves only against the indexed repository version.
**Response (200 OK):**
```json
{
  "id": "file-uuid",
  "file_path": "src/main.py",
  "language": "python",
  "repository_version_id": "version-uuid",
  "content": "def main():\n    pass",
  "size_bytes": 24
}
```
