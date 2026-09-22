import pytest
from uuid import uuid4
from app.services.retrieval.models import RetrievalResult
from app.services.context.models import ContextRequest
from app.services.context.builder import ContextBuilder

def create_retrieval_result(
    content: str,
    file_path: str = "src/main.py",
    chunk_index: int = 0,
    score: float = 1.0,
    source: str = "keyword",
    code_chunk_id=None
) -> RetrievalResult:
    return RetrievalResult(
        code_chunk_id=code_chunk_id or uuid4(),
        repository_version_id=uuid4(),
        file_id=uuid4(),
        symbol_id=None,
        file_path=file_path,
        content=content,
        start_line=1,
        end_line=10,
        chunk_index=chunk_index,
        score=score,
        source=source
    )

class TestContextBuilder:
    def test_basic_assembly_and_provenance(self):
        builder = ContextBuilder()
        r1 = create_retrieval_result(content="def a(): pass")
        r2 = create_retrieval_result(content="def b(): pass", file_path="src/utils.py")
        
        req = ContextRequest(
            query="test",
            retrieval_results=[r1, r2],
            max_context_chars=10000
        )
        
        ctx = builder.build(req)
        
        assert len(ctx.items) == 2
        
        # Provenance checks
        assert ctx.items[0].code_chunk_id == r1.code_chunk_id
        assert ctx.items[0].repository_version_id == r1.repository_version_id
        assert ctx.items[0].file_path == r1.file_path
        assert ctx.items[0].start_line == r1.start_line
        assert ctx.items[0].end_line == r1.end_line
        assert ctx.items[0].retrieval_score == r1.score
        assert ctx.items[0].retrieval_source == r1.source
        
        assert r1.content in ctx.formatted_context
        assert r2.content in ctx.formatted_context
        assert ctx.used_budget > 0
        assert ctx.used_budget == len(ctx.formatted_context)
        assert ctx.max_budget == 10000

    def test_duplicate_removal(self):
        builder = ContextBuilder()
        shared_id = uuid4()
        r1 = create_retrieval_result(content="dup", code_chunk_id=shared_id)
        r2 = create_retrieval_result(content="dup", code_chunk_id=shared_id)
        r3 = create_retrieval_result(content="unique")
        
        req = ContextRequest(query="q", retrieval_results=[r1, r2, r3], max_context_chars=10000)
        ctx = builder.build(req)
        
        assert len(ctx.items) == 2
        assert ctx.items[0].code_chunk_id == shared_id
        assert ctx.items[1].code_chunk_id == r3.code_chunk_id

    def test_ordering_preserved(self):
        builder = ContextBuilder()
        results = [
            create_retrieval_result(content=f"content_{i}")
            for i in range(5)
        ]
        
        req = ContextRequest(query="q", retrieval_results=results, max_context_chars=10000)
        ctx = builder.build(req)
        
        assert len(ctx.items) == 5
        for i in range(5):
            assert ctx.items[i].content == f"content_{i}"

    def test_budget_boundary_fit(self):
        builder = ContextBuilder()
        r1 = create_retrieval_result(content="small")
        
        # Calculate exactly how many chars the formatted version takes
        # by building a dummy one first.
        dummy_req = ContextRequest(query="q", retrieval_results=[r1], max_context_chars=10000)
        dummy_ctx = builder.build(dummy_req)
        exact_budget = dummy_ctx.used_budget
        
        # Should fit exactly
        req = ContextRequest(query="q", retrieval_results=[r1], max_context_chars=exact_budget)
        ctx = builder.build(req)
        assert len(ctx.items) == 1
        
        # Should be excluded if budget is 1 char smaller
        req2 = ContextRequest(query="q", retrieval_results=[r1], max_context_chars=exact_budget - 1)
        ctx2 = builder.build(req2)
        assert len(ctx2.items) == 0

    def test_oversized_chunk_excluded(self):
        builder = ContextBuilder()
        r1 = create_retrieval_result(content="short")
        r2 = create_retrieval_result(content="looooooooooooooooooooooooong")
        r3 = create_retrieval_result(content="short_again")
        
        req = ContextRequest(query="q", retrieval_results=[r1, r2, r3], max_context_chars=10000)
        baseline = builder.build(req)
        
        r1_len = len(builder._format_item(baseline.items[0]))
        r2_len = len(builder._format_item(baseline.items[1]))
        
        # Set budget to fit r1, but NOT r2.
        # r2 should be excluded, and the loop should break (so r3 is NOT evaluated)
        # to preserve ordering.
        budget = r1_len + r2_len - 1
        req2 = ContextRequest(query="q", retrieval_results=[r1, r2, r3], max_context_chars=budget)
        ctx2 = builder.build(req2)
        
        assert len(ctx2.items) == 1
        assert ctx2.items[0].content == "short"

    def test_empty_results(self):
        builder = ContextBuilder()
        req = ContextRequest(query="q", retrieval_results=[], max_context_chars=10000)
        ctx = builder.build(req)
        assert len(ctx.items) == 0
        assert ctx.formatted_context == ""
        assert ctx.used_budget == 0

    def test_multiple_chunks_from_same_file_remain_separate(self):
        builder = ContextBuilder()
        file_id = uuid4()
        r1 = create_retrieval_result(content="c1", file_path="f.py", chunk_index=0)
        # Override file_id for test precision although we create new uuids in create_retrieval_result
        # The key is that they share the same file_path
        r2 = create_retrieval_result(content="c2", file_path="f.py", chunk_index=1)
        
        req = ContextRequest(query="q", retrieval_results=[r1, r2], max_context_chars=10000)
        ctx = builder.build(req)
        
        assert len(ctx.items) == 2
        # They should both be in the formatted string, clearly separated by headers
        assert "CHUNK: " + str(r1.code_chunk_id) in ctx.formatted_context
        assert "CHUNK: " + str(r2.code_chunk_id) in ctx.formatted_context

    def test_determinism(self):
        builder = ContextBuilder()
        results = [
            create_retrieval_result(content=f"c_{i}", score=0.9-i*0.1)
            for i in range(3)
        ]
        
        req1 = ContextRequest(query="q", retrieval_results=results, max_context_chars=10000)
        req2 = ContextRequest(query="q", retrieval_results=results, max_context_chars=10000)
        
        ctx1 = builder.build(req1)
        ctx2 = builder.build(req2)
        
        assert ctx1.formatted_context == ctx2.formatted_context
        assert ctx1.used_budget == ctx2.used_budget

    def test_invalid_budget(self):
        builder = ContextBuilder()
        r1 = create_retrieval_result(content="test")
        
        with pytest.raises(ValueError, match="strictly positive"):
            builder.build(ContextRequest(query="q", retrieval_results=[r1], max_context_chars=0))
            
        with pytest.raises(ValueError, match="strictly positive"):
            builder.build(ContextRequest(query="q", retrieval_results=[r1], max_context_chars=-100))
