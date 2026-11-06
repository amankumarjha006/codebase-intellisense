export interface PrivacyFact {
  topic: string;
  detail: string;
  evidence: string;
}

export const PRIVACY_FACTS: readonly PrivacyFact[] = [
  {
    topic: "Embeddings Storage",
    detail: "Embeddings and code chunks are stored on our servers in PostgreSQL with the pgvector extension.",
    evidence: "server/app/models/knowledge.py",
  },
  {
    topic: "LLM Processing",
    detail: "When a question is asked, retrieved code chunks are sent to our configured LLM provider to synthesize the answer and citations.",
    evidence: "server/app/services/rag/service.py",
  },
  {
    topic: "Repository Scope",
    detail: "Codebase Intellisense currently indexes public GitHub repositories using read-only requests.",
    evidence: "server/app/services/github.py:27",
  },
  {
    topic: "Credential Security",
    detail: "Authentication tokens are encrypted at rest prior to database storage.",
    evidence: "server/app/core/encryption.py",
  },
] as const;
