# ADR 002: GitHub App Authentication

## Context
The platform needs to fetch user repositories and source code from GitHub. We need a secure, scoped, and scalable way to authenticate users and authorize access to their repositories without exposing overly broad permissions or requiring the user to manually generate Personal Access Tokens (PATs).

## Decision
We will use a **GitHub App** for authentication and authorization.

## Reason
- **Least Privilege**: GitHub Apps allow for granular, repository-level permissions (e.g., read-only access to specific repositories) compared to OAuth Apps, which generally request access to all repositories.
- **Security**: The application does not need write access to source code. A GitHub App guarantees read-only access explicitly defined in the app installation. Credentials and tokens remain server-side.
- **Future Proofing**: GitHub Apps provide a solid foundation for adding webhooks in the future (e.g., for incremental re-indexing on push events).
- **Separation of Concerns**: Clearly distinguishes between the application user, their GitHub identity, and the specific repositories the App is authorized to access.

## Alternatives Considered
- **OAuth App**: Rejected because OAuth apps generally have broader scopes and don't provide the fine-grained, repository-by-repository selection that GitHub Apps offer.
- **Personal Access Tokens (PATs)**: Rejected due to terrible UX, security risks of handling raw PATs, and management overhead for users.

## Consequences
- Requires registering a GitHub App and managing App IDs, Client Secrets, and Private Keys securely in the backend environment.
- The authentication flow will involve a redirect to GitHub for installation/authorization, followed by a callback to the FastAPI backend to exchange the code for a token.
