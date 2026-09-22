import pytest
from uuid import uuid4

from app.services.citation.models import Citation
from app.services.answer.models import AnswerRequest
from app.services.answer.service import AnswerService


@pytest.fixture
def answer_service():
    return AnswerService()


@pytest.fixture
def base_citation():
    return Citation(
        citation_id="C1",
        code_chunk_id=uuid4(),
        repository_version_id=uuid4(),
        file_id=uuid4(),
        file_path="src/main.py",
        start_line=10,
        end_line=20,
        retrieval_score=0.9,
        retrieval_source="semantic",
        chunk_index=0
    )


@pytest.fixture
def alternate_citation():
    return Citation(
        citation_id="C2",
        code_chunk_id=uuid4(),
        repository_version_id=uuid4(),
        file_id=uuid4(),
        file_path="src/utils.py",
        start_line=40,
        end_line=50,
        retrieval_score=0.8,
        retrieval_source="keyword",
        chunk_index=1
    )


def test_answer_passes_through_unchanged(answer_service, base_citation):
    original_text = "The authentication flow is handled by the middleware. [C1]"
    req = AnswerRequest(
        answer=original_text,
        citations=(base_citation,)
    )
    res = answer_service.assemble(req)
    
    # Must preserve exact whitespace and citation markers
    assert res.answer == original_text
    assert res.citations == (base_citation,)


def test_citations_pass_through_unchanged(answer_service, base_citation, alternate_citation):
    req = AnswerRequest(
        answer="Multiple sources. [C1] [C2]",
        citations=(base_citation, alternate_citation)
    )
    res = answer_service.assemble(req)
    
    assert len(res.citations) == 2
    assert res.citations[0] == base_citation
    assert res.citations[1] == alternate_citation
    # Ensures ordering is strictly preserved
    assert res.citations == (base_citation, alternate_citation)


def test_answer_with_no_citations(answer_service):
    original_text = "No relevant repository context was found."
    req = AnswerRequest(
        answer=original_text,
        citations=()
    )
    res = answer_service.assemble(req)
    
    assert res.answer == original_text
    assert res.citations == ()


def test_empty_answer(answer_service, base_citation):
    req = AnswerRequest(
        answer="",
        citations=(base_citation,)
    )
    res = answer_service.assemble(req)
    
    assert res.answer == ""
    assert res.citations == (base_citation,)


def test_multiple_citations_preserved(answer_service, base_citation, alternate_citation):
    req = AnswerRequest(
        answer="Used [C1] and [C2].",
        citations=(base_citation, alternate_citation)
    )
    res = answer_service.assemble(req)
    
    assert len(res.citations) == 2
    assert res.citations[0].citation_id == "C1"
    assert res.citations[1].citation_id == "C2"


def test_no_citation_reinterpretation(answer_service):
    # Constructing unusual but valid metadata
    unusual_citation = Citation(
        citation_id="C99",
        code_chunk_id=uuid4(),
        repository_version_id=uuid4(),
        file_id=uuid4(),
        file_path="very/weird/path/script.sh",
        start_line=999,
        end_line=1000,
        retrieval_score=0.1,
        retrieval_source="custom_fallback",
        chunk_index=99
    )
    req = AnswerRequest(
        answer="Weird script [C99].",
        citations=(unusual_citation,)
    )
    res = answer_service.assemble(req)
    
    # Must preserve exactly what CitationService provided
    assert len(res.citations) == 1
    c = res.citations[0]
    assert c.citation_id == "C99"
    assert c.file_path == "very/weird/path/script.sh"
    assert c.start_line == 999
    assert c.retrieval_source == "custom_fallback"
