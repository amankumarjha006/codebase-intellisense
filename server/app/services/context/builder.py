"""
Context Builder implementation.

Transforms a sequence of RetrievalResult objects into a structured
domain representation bounded by a character budget.
"""
from typing import List, Set
from uuid import UUID

from app.services.context.models import ContextRequest, AssembledContext, ContextItem


class ContextBuilder:
    """
    Assembles LLM context from retrieval results.

    Responsibilities:
    - Result ordering preservation
    - Chunk deduplication
    - Content formatting
    - Strict character budget enforcement
    - Provenance preservation
    """

    def build(self, request: ContextRequest) -> AssembledContext:
        if request.max_context_chars <= 0:
            raise ValueError(f"max_context_chars must be strictly positive, got {request.max_context_chars}")

        seen_chunk_ids: Set[UUID] = set()
        items: List[ContextItem] = []
        formatted_blocks: List[str] = []
        used_budget = 0
        
        for res in request.retrieval_results:
            if res.code_chunk_id in seen_chunk_ids:
                continue
                
            seen_chunk_ids.add(res.code_chunk_id)
            
            item = ContextItem(
                code_chunk_id=res.code_chunk_id,
                repository_version_id=res.repository_version_id,
                file_id=res.file_id,
                symbol_id=res.symbol_id,
                file_path=res.file_path,
                start_line=res.start_line,
                end_line=res.end_line,
                content=res.content,
                retrieval_score=res.score,
                retrieval_source=res.source,
                chunk_index=res.chunk_index,
            )
            
            formatted_item = self._format_item(item)
            item_length = len(formatted_item)
            
            # Complete inclusion or complete exclusion
            if used_budget + item_length <= request.max_context_chars:
                items.append(item)
                formatted_blocks.append(formatted_item)
                used_budget += item_length
            else:
                # Stop assembling once a chunk doesn't fit to preserve retrieval ranking order
                break
                
        formatted_context = "".join(formatted_blocks)
        return AssembledContext(
            items=items,
            formatted_context=formatted_context,
            used_budget=used_budget,
            max_budget=request.max_context_chars,
        )

    def _format_item(self, item: ContextItem) -> str:
        """
        Formats a ContextItem deterministically.
        """
        return (
            f"================================================================================\n"
            f"[FILE: {item.file_path}]\n"
            f"[LINES: {item.start_line}-{item.end_line}]\n"
            f"[CHUNK: {item.code_chunk_id}]\n"
            f"[SCORE: {item.retrieval_score:.4f}]\n"
            f"[SOURCE: {item.retrieval_source}]\n\n"
            f"```\n"
            f"{item.content}\n"
            f"```\n\n"
        )
