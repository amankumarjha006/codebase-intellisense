# Codebase Intelligence - Frontend Client (RepoMind)

The frontend client is a single-page application built with **React 19**, **Vite**, **TypeScript**, **Tailwind CSS**, and **React Router v7**.

## Prerequisites

- **Node.js**: >= 20.x
- **npm**: >= 10.x

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```
   The local Vite dev server starts at `http://localhost:3000`.

3. Run test suite:
   ```bash
   npm test
   ```

4. Run linter:
   ```bash
   npm run lint
   ```

## Production Build & Environment Configuration

Vite bakes client-side environment variables prefixed with `VITE_` into static assets during build time.

### Required Build Variable: `VITE_API_URL`

- **Variable:** `VITE_API_URL`
- **Description:** Target base URL of the backend API (e.g. `https://api.yourdomain.com` or `http://localhost:8000`).
- **Enforcement:** The production `Dockerfile` enforces that `VITE_API_URL` is passed as a build argument. If missing or empty, the Docker build fails immediately with:
  ```
  ERROR: VITE_API_URL build argument is required and cannot be empty
  ```

### Building Manually

```bash
VITE_API_URL="https://api.yourdomain.com" npm run build
```

### Docker Build

```bash
docker build \
  --build-arg VITE_API_URL="https://api.yourdomain.com" \
  -t codebase-intellisense-client .
```

When using `infrastructure/docker-compose.prod.yml`, this argument is passed automatically from `${VITE_API_URL:?set it}` in your environment.
