# Codebase Intelligence

An AI-powered GitHub repository analysis platform designed for intelligent codebase understanding, architecture mapping, code search, and grounded Q&A.

---

## Approved Technology Stack

- **Frontend (`client`):** Next.js, React, TypeScript, Tailwind CSS, ESLint
- **Backend (`server`):** Python, FastAPI, Pydantic, SQLAlchemy, Alembic, Uvicorn
- **Database / Vector Store:** PostgreSQL + `pgvector`
- **Infrastructure / Caching:** Docker, Docker Compose, Redis
- **Future AI / Parsing:** Gemini API, Embeddings, Tree-sitter AST parsing

---

## Project Structure

```text
codebase-intelligence/
├── .agents/          # Custom AI agent skills and configuration
├── client/           # Next.js TypeScript frontend
├── server/           # FastAPI Python backend
│   ├── app/          # Backend application code (api, core, models, schemas, services)
│   └── alembic/      # Database migrations
├── infrastructure/   # Docker and deployment configurations
├── docs/             # Architecture and design documentation
├── .env.example      # Environment variable template
├── .gitignore        # Git ignore rules
├── docker-compose.yml# Docker services (PostgreSQL + pgvector, Redis)
├── AGENTS.md         # AGY Agent standards and guardrails
└── README.md         # Project documentation
```

---

## Local Development Quickstart

### 1. Infrastructure (PostgreSQL + Redis)

Start PostgreSQL (with `pgvector`) and Redis containers via Docker Compose:

```bash
docker compose up -d
```

- **PostgreSQL:** `localhost:5432` (`POSTGRES_DB=codebase_intellisense`, `user=postgres`, `pass=postgres`)
- **Redis:** `localhost:6379`

---

### 2. Backend Setup (`server`)

Navigate to `server/`, set up the Python virtual environment, install dependencies, and run the FastAPI server:

```bash
cd server
python -m venv .venv

# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1

# On Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload
```

- **Backend API:** `http://localhost:8000`
- **Health Check:** `http://localhost:8000/health`
- **OpenAPI Swagger Docs:** `http://localhost:8000/docs`

---

### 3. Frontend Setup (`client`)

Navigate to `client/`, install dependencies, and start the Next.js development server:

```bash
cd client
npm install
npm run dev
```

- **Frontend App:** `http://localhost:3000`

---

## Environment Variables

Copy `.env.example` to `.env` in the root directory and update variable values as required for local development:

```bash
cp .env.example .env
```
