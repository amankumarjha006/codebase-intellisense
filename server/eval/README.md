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

## Phase 4.5.1 Evaluation Analysis

### 1. Evaluation Scope
The evaluation covers the exact identifier, conceptual, architectural, and error-based retrieval capabilities of the Codebase Intelligence backend using three retrieval strategies:
- **Keyword**: Deterministic substring search using PostgreSQL `ILIKE` on code chunks.
- **Semantic**: Vector search using cosine distance on chunk embeddings via `pgvector`.
- **Hybrid**: Rank fusion of Keyword and Semantic using Reciprocal Rank Fusion (RRF).

### 2. Dataset Composition
The dataset consists of 25 hand-crafted queries explicitly mapped to 25 single-chunk ground-truth targets (with the exception of some conceptual queries optionally mapped to multiple chunks) in the `pallets/itsdangerous` pinned repository snapshot (`672971d66a2ef9f85151e53283113f33d642dabd`).
- **Exact Identifier**: 6 queries
- **Conceptual**: 8 queries
- **Architecture**: 4 queries
- **Error / Debugging**: 5 queries
- **Path Oriented**: 2 queries

### 3. Baseline Benchmark Results
With the dataset ground-truth updated to accurately target the observed chunk allocations, the current benchmark yields the following metrics:

| Strategy | Recall@5 | Recall@10 | Recall@20 | MRR@5 | MRR@10 | MRR@20 | NDCG@5 | NDCG@10 | NDCG@20 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **Keyword** | 0.160 | 0.200 | 0.240 | 0.041 | 0.048 | 0.051 | 0.070 | 0.084 | 0.095 |
| **Semantic** | 0.773 | 0.927 | 0.967 | 0.608 | 0.624 | 0.624 | 0.625 | 0.680 | 0.693 |
| **Hybrid** | 0.773 | 0.927 | 0.967 | 0.541 | 0.559 | 0.559 | 0.575 | 0.633 | 0.645 |

### 4. Category-level Observations
- **Exact Identifier**: Keyword performs adequately when class or variable names are searched directly, but ranks them alphabetically by file path/chunk index due to `ILIKE` limitations. Semantic retrieval often ranks them higher. Hybrid provides a safety net by combining both.
- **Conceptual & Architectural**: Keyword completely fails (Recall=0) on natural language sentences like "how is time-based expiration handled?" because it performs literal substring matching. Semantic retrieval dominates this category.
- **Error / Debugging**: Keyword fails even when specific error names like `BadSignature` are included in natural language queries (e.g., "why do I get BadSignature when decoding?") due to literal substring limitations. Semantic handles these easily.
- **Path Oriented**: Keyword struggles with abstract path descriptions; Semantic correctly maps the intent to the corresponding files.

### 5. Query-level Observations
- **Keyword succeeds, Semantic struggles (q002: "SignatureExpired")**: Keyword found it at rank 4, while Semantic pushed it to rank 9. Hybrid pulled it up to rank 6. This demonstrates the value of Hybrid retrieval when Semantic similarity vectors dilute an exact symbol search.
- **Semantic succeeds, Keyword fails (q013: "how are signatures generated using HMAC")**: Keyword completely missed this because the phrase is not a literal substring. Semantic found it at rank 4.
- **Hybrid differs from Semantic (q001: "URLSafeSerializer")**: Semantic ranked the correct chunk #1. Keyword found it, but due to alphabetical path sorting (`docs/` < `src/`), it ranked a documentation file first, pushing the source code to rank 6. Because Keyword gave a false-positive the #1 boost, Hybrid RRF lowered the ground truth chunk to rank 2.
- **None retrieve within Top 20**: The dataset baseline currently achieves 0.967 Recall@20 for Semantic/Hybrid, meaning nearly all queries have their ground-truth chunk retrieved within the top 20 limits.

### 6. Ground-Truth Audit
The ground-truth audit of `dataset.jsonl` found two human labeling errors that were corrected:
1. `q005 (TimedSerializer)`: Initially mapped to `src/itsdangerous/timed.py` chunk index `0`. The class definition is actually located in chunk index `1`.
2. `q010 (how does the serializer sign data?)`: Initially mapped to `src/itsdangerous/serializer.py` chunk index `1`. Chunk 1 contains only the `__init__` overloads. The actual data signing (`dumps`) occurs in chunk index `2`.

These corrections were applied, improving the benchmark baseline (Keyword Recall@20 increased from 0.200 to 0.240).

### 7. Limitations
- **Sample Size**: The dataset is exceptionally small (25 queries) and targets a single, tiny repository (`itsdangerous` is ~1,000 LOC).
- **Keyword Constraints**: The current Keyword strategy is an exact substring `ILIKE` rather than a tokenized full-text search (BM25 or similar), which severely limits its capability on natural language.
- **Binary Relevance**: Real-world retrieval often requires synthesizing information across multiple chunks (e.g., a class definition in chunk 1 and its methods in chunk 2), but this benchmark expects a single "perfect" chunk.

### 8. Conclusions
On this 25-query evaluation of the pinned `itsdangerous` fixture, semantic retrieval achieved significantly higher measured Recall and MRR than keyword retrieval across almost all categories. However, Keyword still provides critical value for exact identifiers (improving ranks for queries like `SignatureExpired`). Hybrid retrieval safely preserves Semantic's high recall while slightly sacrificing MRR in some edge cases due to the Keyword strategy's primitive ranking algorithm (alphabetical tie-breaking).

### 9. Follow-up Recommendations
The evaluation validates the current architecture but exposes the limitations of the existing Keyword strategy. 
**Next Step for Phase 4.5.2**: Improve the Keyword Retrieval strategy by replacing the rigid `ILIKE` substring match with PostgreSQL `tsvector` / `tsquery` full-text search or token-based BM25 to allow keyword retrieval to successfully match individual keywords within natural language queries and rank them by Term Frequency rather than alphabetical file paths.

## Phase 4.5.2 Lexical Retrieval Upgrade Evaluation

Following the implementation of Phase 4.5.2, the Keyword Retrieval strategy was upgraded to a dual `ILIKE` + `to_tsvector('english')` search. The goal was to improve keyword retrieval for natural language queries while preserving exact code identifier matching, and ranking the results by relevance (`ts_rank_cd`).

### 1. Benchmark Results (Phase 4.5.2)
Running the identical 25-query evaluation fixture yields the following metrics:

| Strategy | Recall@5 | Recall@10 | Recall@20 | MRR@5 | MRR@10 | MRR@20 | NDCG@5 | NDCG@10 | NDCG@20 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **Keyword** | 0.380 | 0.460 | 0.500 | 0.301 | 0.313 | 0.315 | 0.310 | 0.337 | 0.347 |
| **Semantic** | 0.773 | 0.927 | 0.967 | 0.608 | 0.624 | 0.624 | 0.625 | 0.680 | 0.693 |
| **Hybrid** | 0.753 | 0.907 | 0.967 | 0.608 | 0.619 | 0.623 | 0.619 | 0.675 | 0.692 |

### 2. Analysis of Improvements
- **Keyword Performance Doubled**: The Keyword strategy saw a massive improvement across all metrics compared to Phase 4.5.1. Recall@20 jumped from `0.240` to `0.500` (+108%), and MRR@20 jumped from `0.051` to `0.315` (+517%).
- **Natural Language Support**: The massive increase in Keyword performance is due to PostgreSQL Full-Text Search correctly tokenizing and matching natural language queries like "how does the serializer sign data?". In Phase 4.5.1, `ILIKE` returned zero results for these queries. Now, FTS returns relevant results ranked by Term Frequency.
- **Exact Matches Preserved**: As validated during testing, exact identifier searches (e.g., `a\%b`, `my_var`) continue to match correctly and are explicitly boosted with a +1.0 score to ensure they outrank generic natural-language text matches.
- **Hybrid Fusion Stability**: The Hybrid strategy (RRF fusion of Keyword + Semantic) maintained its high Recall (0.967) while experiencing slight bumps in MRR and NDCG due to the improved relevance of the underlying Keyword candidate list.

### 3. Conclusion
The Phase 4.5.2 lexical retrieval upgrade successfully solved the primary limitations of the pure `ILIKE` strategy. By combining robust exact substring matching (vital for arbitrary code identifiers) with `websearch_to_tsquery` (vital for natural language), the system now provides a highly competent lexical baseline that strongly complements Semantic retrieval through RRF.
