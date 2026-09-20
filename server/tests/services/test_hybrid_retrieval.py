import pytest
from uuid import uuid4
from typing import List

from app.services.retrieval.models import RetrievalRequest, RetrievalResult
from app.services.retrieval.strategies import HybridRetrievalStrategy, RetrievalStrategy
from app.services.indexing import EmbeddingError

class FakeRetrievalStrategy(RetrievalStrategy):
    def __init__(self, results: List[RetrievalResult], error: Exception | None = None):
        self.results = results
        self.error = error
        self.last_request = None

    def retrieve(self, request: RetrievalRequest) -> List[RetrievalResult]:
        self.last_request = request
        if self.error:
            raise self.error
        return self.results



def setup_strategy(keyword_results, semantic_results, semantic_error=None, candidate_limit=50):
    k_strat = FakeRetrievalStrategy(keyword_results)
    s_strat = FakeRetrievalStrategy(semantic_results, error=semantic_error)
    h_strat = HybridRetrievalStrategy(k_strat, s_strat, candidate_limit=candidate_limit)
    return h_strat, k_strat, s_strat

def test_rrf_exactness():
    chunk_1 = uuid4()
    chunk_2 = uuid4()
    
    # Keyword: chunk_1 (rank 1), chunk_2 (rank 2)
    k_res = [
        RetrievalResult(symbol_id=None, code_chunk_id=chunk_1, repository_version_id=uuid4(), file_id=uuid4(), file_path="a.py", content="", start_line=1, end_line=2, chunk_index=0, score=1.0, source="k"),
        RetrievalResult(symbol_id=None, code_chunk_id=chunk_2, repository_version_id=uuid4(), file_id=uuid4(), file_path="b.py", content="", start_line=1, end_line=2, chunk_index=0, score=1.0, source="k"),
    ]
    
    # Semantic: chunk_2 (rank 1), chunk_1 (rank 2)
    s_res = [
        RetrievalResult(symbol_id=None, code_chunk_id=chunk_2, repository_version_id=uuid4(), file_id=uuid4(), file_path="b.py", content="", start_line=1, end_line=2, chunk_index=0, score=0.9, source="s"),
        RetrievalResult(symbol_id=None, code_chunk_id=chunk_1, repository_version_id=uuid4(), file_id=uuid4(), file_path="a.py", content="", start_line=1, end_line=2, chunk_index=0, score=0.8, source="s"),
    ]
    
    h_strat, _, _ = setup_strategy(k_res, s_res)
    req = RetrievalRequest(repository_version_id=uuid4(), query="test", limit=10)
    results = h_strat.retrieve(req)
    
    assert len(results) == 2
    
    # chunk_1 RRF: 1/(60+1) + 1/(60+2) = 1/61 + 1/62 = 0.016393 + 0.016129 = 0.032522...
    # chunk_2 RRF: 1/(60+2) + 1/(60+1) = 1/62 + 1/61 = 0.032522...
    expected_score = (1 / 61) + (1 / 62)
    
    assert results[0].score == expected_score
    assert results[1].score == expected_score

def test_deduplication():
    chunk = uuid4()
    k_res = [RetrievalResult(symbol_id=None, code_chunk_id=chunk, repository_version_id=uuid4(), file_id=uuid4(), file_path="a.py", content="", start_line=1, end_line=2, chunk_index=0, score=1.0, source="k")]
    s_res = [RetrievalResult(symbol_id=None, code_chunk_id=chunk, repository_version_id=uuid4(), file_id=uuid4(), file_path="a.py", content="", start_line=1, end_line=2, chunk_index=0, score=0.9, source="s")]
    
    h_strat, _, _ = setup_strategy(k_res, s_res)
    req = RetrievalRequest(repository_version_id=uuid4(), query="test", limit=10)
    results = h_strat.retrieve(req)
    
    assert len(results) == 1
    assert results[0].score == (1/61) + (1/61)

def test_candidate_depth():
    h_strat, k_strat, s_strat = setup_strategy([], [], candidate_limit=50)
    req = RetrievalRequest(repository_version_id=uuid4(), query="test", limit=10)
    h_strat.retrieve(req)
    
    assert k_strat.last_request.limit == 50
    assert s_strat.last_request.limit == 50

def test_final_limit():
    k_res = [RetrievalResult(symbol_id=None, code_chunk_id=uuid4(), repository_version_id=uuid4(), file_id=uuid4(), file_path=f"{i}.py", content="", start_line=1, end_line=2, chunk_index=0, score=1.0, source="k") for i in range(15)]
    s_res = []
    
    h_strat, _, _ = setup_strategy(k_res, s_res)
    req = RetrievalRequest(repository_version_id=uuid4(), query="test", limit=5)
    results = h_strat.retrieve(req)
    
    assert len(results) == 5

def test_deterministic_ordering():
    chunk_1 = uuid4()
    chunk_2 = uuid4()
    
    # Tie scores, so ordering falls back to file_path
    k_res = [
        RetrievalResult(symbol_id=None, code_chunk_id=chunk_1, repository_version_id=uuid4(), file_id=uuid4(), file_path="z.py", content="", start_line=1, end_line=2, chunk_index=0, score=1.0, source="k"),
        RetrievalResult(symbol_id=None, code_chunk_id=chunk_2, repository_version_id=uuid4(), file_id=uuid4(), file_path="a.py", content="", start_line=1, end_line=2, chunk_index=0, score=1.0, source="k"),
    ]
    s_res = [
        RetrievalResult(symbol_id=None, code_chunk_id=chunk_2, repository_version_id=uuid4(), file_id=uuid4(), file_path="a.py", content="", start_line=1, end_line=2, chunk_index=0, score=0.9, source="s"),
        RetrievalResult(symbol_id=None, code_chunk_id=chunk_1, repository_version_id=uuid4(), file_id=uuid4(), file_path="z.py", content="", start_line=1, end_line=2, chunk_index=0, score=0.8, source="s"),
    ]
    
    h_strat, _, _ = setup_strategy(k_res, s_res)
    req = RetrievalRequest(repository_version_id=uuid4(), query="test", limit=10)
    results = h_strat.retrieve(req)
    
    assert len(results) == 2
    # chunk_2 ("a.py") should be first because of alphabetical order since scores are tied
    assert results[0].code_chunk_id == chunk_2
    assert results[1].code_chunk_id == chunk_1

def test_semantic_failure_fallback():
    k_res = [RetrievalResult(symbol_id=None, code_chunk_id=uuid4(), repository_version_id=uuid4(), file_id=uuid4(), file_path="k.py", content="", start_line=1, end_line=2, chunk_index=0, score=1.0, source="k")]
    
    h_strat, _, _ = setup_strategy(k_res, [], semantic_error=EmbeddingError("API down"))
    req = RetrievalRequest(repository_version_id=uuid4(), query="test", limit=10)
    results = h_strat.retrieve(req)
    
    assert len(results) == 1
    assert results[0].source == "hybrid"
    assert results[0].score == 1/61

def test_unexpected_exception_propagation():
    k_res = []
    
    h_strat, _, _ = setup_strategy(k_res, [], semantic_error=ValueError("Unexpected DB error"))
    req = RetrievalRequest(repository_version_id=uuid4(), query="test", limit=10)
    
    with pytest.raises(ValueError):
        h_strat.retrieve(req)

def test_keyword_only_candidates():
    k_res = [RetrievalResult(symbol_id=None, code_chunk_id=uuid4(), repository_version_id=uuid4(), file_id=uuid4(), file_path="k.py", content="", start_line=1, end_line=2, chunk_index=0, score=1.0, source="k")]
    h_strat, _, _ = setup_strategy(k_res, [])
    req = RetrievalRequest(repository_version_id=uuid4(), query="test", limit=10)
    results = h_strat.retrieve(req)
    assert len(results) == 1
    assert results[0].score == 1/61

def test_semantic_only_candidates():
    s_res = [RetrievalResult(symbol_id=None, code_chunk_id=uuid4(), repository_version_id=uuid4(), file_id=uuid4(), file_path="s.py", content="", start_line=1, end_line=2, chunk_index=0, score=0.9, source="s")]
    h_strat, _, _ = setup_strategy([], s_res)
    req = RetrievalRequest(repository_version_id=uuid4(), query="test", limit=10)
    results = h_strat.retrieve(req)
    assert len(results) == 1
    assert results[0].score == 1/61

def test_empty_results():
    h_strat, _, _ = setup_strategy([], [])
    req = RetrievalRequest(repository_version_id=uuid4(), query="test", limit=10)
    results = h_strat.retrieve(req)
    assert len(results) == 0

def test_version_propagation():
    repo_version = uuid4()
    query = "find this"
    
    h_strat, k_strat, s_strat = setup_strategy([], [])
    req = RetrievalRequest(repository_version_id=repo_version, query=query, limit=10)
    h_strat.retrieve(req)
    
    assert k_strat.last_request.repository_version_id == repo_version
    assert k_strat.last_request.query == query
    
    assert s_strat.last_request.repository_version_id == repo_version
    assert s_strat.last_request.query == query

def test_deterministic_ordering_by_chunk_index():
    chunk_1 = uuid4()
    chunk_2 = uuid4()
    
    # Same score, same file_path ("a.py"), different chunk_index
    # To get the same score, they need to swap ranks in keyword vs semantic
    k_res = [
        RetrievalResult(symbol_id=None, code_chunk_id=chunk_2, repository_version_id=uuid4(), file_id=uuid4(), file_path="a.py", content="", start_line=1, end_line=2, chunk_index=1, score=1.0, source="k"),
        RetrievalResult(symbol_id=None, code_chunk_id=chunk_1, repository_version_id=uuid4(), file_id=uuid4(), file_path="a.py", content="", start_line=1, end_line=2, chunk_index=0, score=1.0, source="k"),
    ]
    s_res = [
        RetrievalResult(symbol_id=None, code_chunk_id=chunk_1, repository_version_id=uuid4(), file_id=uuid4(), file_path="a.py", content="", start_line=1, end_line=2, chunk_index=0, score=0.9, source="s"),
        RetrievalResult(symbol_id=None, code_chunk_id=chunk_2, repository_version_id=uuid4(), file_id=uuid4(), file_path="a.py", content="", start_line=1, end_line=2, chunk_index=1, score=0.8, source="s"),
    ]
    
    h_strat, _, _ = setup_strategy(k_res, s_res)
    req = RetrievalRequest(repository_version_id=uuid4(), query="test", limit=10)
    results = h_strat.retrieve(req)
    
    assert len(results) == 2
    # chunk_1 (chunk_index=0) should be first
    assert results[0].code_chunk_id == chunk_1
    assert results[1].code_chunk_id == chunk_2
