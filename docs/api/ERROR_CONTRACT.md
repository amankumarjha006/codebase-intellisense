# Error Contract

All FastAPI endpoints will return a consistent error format when a request fails. Internal stack traces, database errors, or GitHub tokens are never exposed.

## Global Error Response Schema

```json
{
  "error": {
    "code": "STRING_ERROR_CODE",
    "message": "Human readable error message detailing what went wrong."
  }
}
```

## HTTP Status Codes & Error Codes

### 400 Bad Request
Used when the client sends malformed data (outside of Pydantic validation) or breaks business logic rules.
- `INVALID_REQUEST`: The request logic is invalid.
- `UNSUPPORTED_REPOSITORY`: The provided GitHub URL is not a valid or supported repository format.

### 401 Unauthorized
Used when the user's session is missing, expired, or invalid.
- `UNAUTHENTICATED`: User session cookie is missing or invalid.

### 403 Forbidden
Used when the user is authenticated but does not have permission to perform the action.
- `UNAUTHORIZED_ACCESS`: The user's GitHub Installation does not grant access to the requested repository.

### 404 Not Found
Used when a requested resource does not exist, or if the user lacks permissions (to prevent existence leakage).
- `REPOSITORY_NOT_FOUND`: The repository ID was not found.
- `FILE_NOT_FOUND`: The requested file path does not exist in the active repository version.
- `JOB_NOT_FOUND`: The indexing job does not exist.

### 409 Conflict
Used when a request conflicts with the current state of the server.
- `INDEXING_ALREADY_IN_PROGRESS`: An indexing job is already in progress for this repository. (Applicable when status is QUEUED, FETCHING, INDEXING, or ANALYZING).

### 422 Unprocessable Entity
Used by FastAPI/Pydantic automatically when request validation fails.
```json
{
  "detail": [
    {
      "loc": ["body", "url"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

### 429 Too Many Requests
Used for rate limiting.
- `RATE_LIMIT_EXCEEDED`: The user has made too many requests.

### 500 Internal Server Error
Used for unhandled backend exceptions.
- `INTERNAL_SERVER_ERROR`: An unexpected error occurred on the server.

### 502 Bad Gateway
Used when an upstream service returns an invalid response.
- `GITHUB_API_ERROR`: Failed to communicate with GitHub.

### 503 Service Unavailable
Used when an external service is down or timing out.
- `AI_SERVICE_UNAVAILABLE`: Gemini API is down or timing out.
