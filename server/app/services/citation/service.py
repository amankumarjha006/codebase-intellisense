"""
Citation Service.
"""
import re
from typing import Dict

from app.services.citation.models import Citation, CitationRequest, CitationResponse


class CitationService:
    """
    Parses and validates citations from the LLM response against 
    authoritative context provenance.
    """
    
    def create_citations(self, request: CitationRequest) -> CitationResponse:
        """
        Extracts selected source IDs (e.g. [C1], [C2]) from the LLM answer,
        validates them against the context, and returns authoritative citations.
        """
        # Find all cited IDs like [C1], [C2], etc.
        source_ids = set(re.findall(r'\[C(\d+)\]', request.answer))
        
        citations_by_chunk: Dict[str, Citation] = {}
        
        # ContextItems are 1-indexed to match prompt's C1, C2...
        for i, item in enumerate(request.context_items, start=1):
            if str(i) not in source_ids:
                # LLM didn't cite this source
                continue
                
            chunk_key = str(item.code_chunk_id)
            if chunk_key in citations_by_chunk:
                # Duplicate chunks are merged into a single citation (first occurrence wins)
                continue
                
            citation = Citation(
                citation_id=f"C{i}",
                code_chunk_id=item.code_chunk_id,
                repository_version_id=item.repository_version_id,
                file_id=item.file_id,
                file_path=item.file_path,
                start_line=item.start_line,
                end_line=item.end_line,
                retrieval_score=item.retrieval_score,
                retrieval_source=item.retrieval_source,
                chunk_index=item.chunk_index
            )
            citations_by_chunk[chunk_key] = citation
            
        return CitationResponse(citations=tuple(citations_by_chunk.values()))
