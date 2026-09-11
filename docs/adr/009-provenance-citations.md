# ADR 009: Repository Provenance and Citations

## Context
AI-powered applications handling untrusted data (source code) face challenges with grounding, hallucinations, and prompt injection. If an AI provides an answer about the codebase, the user must be able to verify where that information came from.

## Decision
We will establish **Source Provenance** as a foundational requirement. Every piece of derived knowledge and every AI response must retain traceablity back to the specific repository, version, file, and line range. We will surface this via **Citations**.

## Reason
- **Trust and Verifiability**: Users will only trust the system if they can click a citation and verify the exact code the AI used to generate its answer.
- **Security Context**: Keeping track of provenance allows the Context Builder to separate untrusted repository content from trusted system instructions when communicating with the LLM, mitigating prompt injection risks.
- **Evaluation**: Makes it possible to programmatically evaluate groundedness (did the AI base its answer strictly on the retrieved chunks?).

## Alternatives Considered
- **No Citations**: Rejected because it degrades the product into an opaque oracle, reducing developer trust.

## Consequences
- The database schema for `Chunks` and `Symbols` must include `file_path`, `start_line`, `end_line`, and `repository_version_id`.
- The RAG Context Builder must inject this metadata into the prompt context.
- The AI must be instructed to return responses with structured citations referencing the provided context blocks.
- The frontend must parse these citations to provide interactive links to the Code Viewer.
