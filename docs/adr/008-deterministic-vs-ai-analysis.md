# ADR 008: Separation of Deterministic Analysis from AI Analysis

## Context
When analyzing a repository to present an overview, technology stack, and architecture, it is tempting to feed all available data to a Large Language Model (LLM) and ask it to generate the insights. However, this is slow, expensive, prone to hallucinations, and difficult to verify.

## Decision
We will enforce a strict separation between **Deterministic Analysis** and **AI Generation** within the Analysis Engine. We will extract basic facts deterministically and only use the LLM (Gemini) for reasoning, summarization, and explanation when deterministic methods are insufficient.

## Reason
- **Accuracy & Groundedness**: Deterministic checks (e.g., parsing a `package.json` to detect React) have 100% precision. LLMs can hallucinate dependencies.
- **Cost & Latency**: Running rules-based analysis over ASTs and configuration files is orders of magnitude faster and cheaper than passing thousands of tokens to an LLM.
- **Clear Boundaries**: The LLM acts as an explainer of the Knowledge Layer, rather than the primary parser of the source code.

## Alternatives Considered
- **Pure LLM Analysis**: Rejected due to high token costs, latency, and the likelihood of hallucinating unverified technology claims.

## Consequences
- The Analysis Engine must implement rule-based logic to detect technologies (e.g., checking `requirements.txt`, `pom.xml`, `docker-compose.yml`, imports).
- The AI will consume these deterministically generated insights to draft the final "Project Overview" or summarize the architecture graph, rather than deducing the architecture from scratch.
