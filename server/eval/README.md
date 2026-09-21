# Phase 4.4 Retrieval Evaluation

This directory contains the benchmarking and evaluation suite for the Codebase Intelligence retrieval system.

## Evaluation Fixture

The benchmark evaluates retrieval against a dedicated, static **evaluation fixture repository** rather than the production application codebase. This ensures reproducibility, isolates benchmark state from production databases, and prevents cyclic dependencies.

**Fixture Repository Identity:**
- **Owner**: `pallets`
- **Name**: `itsdangerous`
- **Commit SHA**: `672971d66a2ef9f85151e53283113f33d642dabd`

This is a small, stable Python library with diverse coding patterns (classes, functions, exceptions, cryptography) perfectly suited for exact identifier, conceptual, and architectural queries.

## 1. Preparation

Before running the benchmark, the fixture repository must be indexed into your local PostgreSQL instance using the normal production indexing pipeline.

Ensure your `server/.env` file has the correct embedding model and a valid Gemini API key:
```env
GEMINI_API_KEY=your_api_key_here
EMBEDDING_MODEL=gemini-embedding-2
```

Run the provided fixture indexing script from the root of the project:
```bash
python scripts/index_fixture.py
```

This will:
1. Create a `Repository` record for `pallets/itsdangerous`
2. Create a `RepositoryVersion` pinned to `672971d66a2ef9f85151e53283113f33d642dabd`
3. Clone the repository into a temp directory
4. Process chunking, symbol extraction, and Gemini embeddings
5. Save everything to your local database with `index_status = SUCCESS`

## 2. Running the Benchmark

Once the fixture is successfully indexed, you can run the benchmark:

```bash
cd server/
python -m eval.run_benchmark
```

To see individual query evaluations and the rank of the first relevant document per strategy, use `--verbose`:
```bash
python -m eval.run_benchmark --verbose
```

### Note on Query Embeddings Cache

The benchmark generates embeddings for the 25 evaluation queries using the production `GeminiEmbeddingProvider`. To avoid unnecessary API calls and ensure consistent evaluation latency, these embeddings are cached locally in:
`server/eval/query_embeddings_cache.json`

This cache file is ignored by Git.

## Production Isolation

The evaluation framework explicitly avoids modifying any production search endpoints, contracts, or models. It composes the exact same `KeywordRetrievalStrategy`, `SemanticRetrievalStrategy`, and `HybridRetrievalStrategy` instances as the production `/search` API.

**Benchmark metrics evaluated:**
- Recall@5, 10, 20
- MRR@5, 10, 20
- NDCG@5, 10, 20
