import pytest
from uuid import uuid4

from app.services.context.models import ContextItem
from app.services.citation.models import CitationRequest, Citation
from app.services.citation.service import CitationService


@pytest.fixture
def citation_service():
    return CitationService()


@pytest.fixture
def base_context_item():
    return ContextItem(
        code_chunk_id=uuid4(),
        repository_version_id=uuid4(),
        file_id=uuid4(),
        symbol_id=None,
        file_path="src/main.py",
        start_line=10,
        end_line=20,
        content="def main(): pass",
        retrieval_score=0.9,
        retrieval_source="semantic",
        chunk_index=0
    )


def test_basic_citation(citation_service, base_context_item):
    req = CitationRequest(
        answer="This is supported by [C1].",
        context_items=(base_context_item,)
    )
    res = citation_service.create_citations(req)
    
    assert len(res.citations) == 1
    c = res.citations[0]
    assert c.citation_id == "C1"
    assert c.code_chunk_id == base_context_item.code_chunk_id
    assert c.file_path == base_context_item.file_path
    assert c.start_line == 10
    assert c.end_line == 20


def test_provenance_preservation(citation_service, base_context_item):
    req = CitationRequest(answer="[C1]", context_items=(base_context_item,))
    res = citation_service.create_citations(req)
    
    c = res.citations[0]
    # Ensure all authoritative metadata comes directly from ContextItem
    assert c.repository_version_id == base_context_item.repository_version_id
    assert c.file_id == base_context_item.file_id
    assert c.retrieval_score == base_context_item.retrieval_score
    assert c.retrieval_source == base_context_item.retrieval_source
    assert c.chunk_index == base_context_item.chunk_index


def test_stable_source_ids(citation_service, base_context_item):
    # Identical context should produce identical IDs (C1, C2) based on order
    item2 = ContextItem(
        code_chunk_id=uuid4(),
        repository_version_id=base_context_item.repository_version_id,
        file_id=uuid4(),
        symbol_id=None,
        file_path="src/other.py",
        start_line=1,
        end_line=5,
        content="x = 1",
        retrieval_score=0.8,
        retrieval_source="keyword",
        chunk_index=0
    )
    req = CitationRequest(answer="[C1] and [C2]", context_items=(base_context_item, item2))
    res = citation_service.create_citations(req)
    
    assert len(res.citations) == 2
    assert res.citations[0].citation_id == "C1"
    assert res.citations[0].file_path == "src/main.py"
    
    assert res.citations[1].citation_id == "C2"
    assert res.citations[1].file_path == "src/other.py"


def test_unknown_source_id_rejected(citation_service, base_context_item):
    req = CitationRequest(
        answer="This cites [C1] but also [C999] and [C2].",
        context_items=(base_context_item,)
    )
    res = citation_service.create_citations(req)
    
    # Only C1 is valid in the context
    assert len(res.citations) == 1
    assert res.citations[0].citation_id == "C1"


def test_duplicate_sources(citation_service, base_context_item):
    # LLM repeats the same citation
    req = CitationRequest(answer="See [C1] and again [C1].", context_items=(base_context_item,))
    res = citation_service.create_citations(req)
    
    assert len(res.citations) == 1


def test_duplicate_chunks(citation_service, base_context_item):
    # Same chunk appears twice in context items (should be rare due to deduplication, 
    # but service must handle it deterministically)
    req = CitationRequest(answer="[C1] and [C2]", context_items=(base_context_item, base_context_item))
    res = citation_service.create_citations(req)
    
    # Only one citation produced per chunk
    assert len(res.citations) == 1
    assert res.citations[0].citation_id == "C1"


def test_empty_answer_no_citations(citation_service, base_context_item):
    req = CitationRequest(answer="No citations here.", context_items=(base_context_item,))
    res = citation_service.create_citations(req)
    
    assert len(res.citations) == 0


def test_empty_context_no_citations(citation_service):
    req = CitationRequest(answer="[C1]", context_items=())
    res = citation_service.create_citations(req)
    
    assert len(res.citations) == 0


def test_malicious_source_id(citation_service, base_context_item):
    req = CitationRequest(
        answer="I looked at ../../secret and [C1] and [fake/path.py] and commit 1234abcd",
        context_items=(base_context_item,)
    )
    res = citation_service.create_citations(req)
    
    assert len(res.citations) == 1
    assert res.citations[0].citation_id == "C1"
    # None of the fabricated paths become citations
