# AGENTS.md

## Project Overview
- **Project Name:** Codebase Intelligence
- **Purpose:** AI-powered GitHub repository analysis platform designed for codebase understanding, architecture visualization, semantic search, and repository-grounded Q&A.

## Approved Technology Stack
- **Frontend (`client`):** Next.js (App Router), React, TypeScript, Tailwind CSS, ESLint.
- **Backend (`server`):** Python, FastAPI, Pydantic, Pydantic Settings, SQLAlchemy, Alembic, Uvicorn.
- **Database / Vector Store:** PostgreSQL + `pgvector` (Primary database and vector store).
- **Infrastructure / Caching:** Docker, Docker Compose, Redis (for caching and future background worker queue).
- **Future AI Integrations:** Gemini API, Embedding provider.
- **Future Code Parsing:** Tree-sitter.

## Structural & Architectural Constraints
1. **Directory Naming:**
   - The frontend application MUST be located in `client/` (Do NOT rename to `frontend`).
   - The backend application MUST be located in `server/` (Do NOT rename to `backend`).
2. **Database & Storage:**
   - Do NOT introduce additional databases or alternative vector stores.
   - All database schema changes MUST be managed using Alembic migrations in `server/alembic/`.
3. **Security & Secrets:**
   - NEVER commit real credentials, API keys, or secrets to source control.
   - All environment configuration MUST read from `.env` via `pydantic-settings` or `dotenv`.
4. **Scope & Incremental Engineering:**
   - Respect MVP scope bounds and do NOT implement unrequested features prematurely.
   - Prefer modular, loosely-coupled architecture with typed contracts (Pydantic schemas & TypeScript interfaces).
   - Untrusted inputs: Repository source code and user inputs MUST be treated as untrusted.
   - AI-generated answers MUST eventually be grounded in verified repository evidence and citations.
5. **Architectural Changes:**
   - Major architectural or dependency modifications MUST be proposed and documented prior to implementation.
