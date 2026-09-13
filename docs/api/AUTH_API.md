# Auth API Contracts

## 1. Initiate GitHub App Authorization
**Endpoint:** `GET /api/v1/auth/github`
**Purpose:** Initiates the GitHub App user authorization flow.
**Auth Required:** No
**Response:** `302 Found` (Redirects to GitHub authorization page).

## 2. GitHub Auth Callback
**Endpoint:** `GET /api/v1/auth/github/callback`
**Purpose:** Handles the GitHub code exchange, provisions the user, and issues a session cookie.
**Auth Required:** No
**Query Parameters:**
- `code`: The authorization code from GitHub.
- `state`: CSRF state token.
- `installation_id`: (Optional) If the flow originated from an app installation.
**Response:** `302 Found` (Redirects to the Next.js dashboard with a `Set-Cookie` header).
*Note: GitHub App Client ID, Client Secret, and installation tokens remain server-side.*

## 3. Get Current User
**Endpoint:** `GET /api/v1/auth/me`
**Purpose:** Retrieves the authenticated user's profile.
**Auth Required:** Yes
**Response (200 OK):**
```json
{
  "id": "uuid-1234",
  "email": "user@example.com",
  "full_name": "Jane Doe",
  "github": {
    "username": "janedoe",
    "github_user_id": "987654321"
  }
}
```
**Error (401 Unauthorized):**
```json
{
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "User session is invalid or missing."
  }
}
```

## 4. Logout
**Endpoint:** `POST /api/v1/auth/logout`
**Purpose:** Destroys the authentication session.
**Auth Required:** Yes
**Response (204 No Content):** (Returns empty body, clears the `Set-Cookie` header).
