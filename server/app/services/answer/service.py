"""
Answer Service implementation.
"""
from app.services.answer.models import AnswerRequest, AnswerResponse


class AnswerService:
    """
    Final answer assembly layer.
    
    This service deterministically combines the LLM-generated answer text 
    with validated authoritative citations. It does not perform inference,
    modification, rewriting, or database persistence.
    """

    def assemble(self, request: AnswerRequest) -> AnswerResponse:
        """
        Assembles the final answer response from the request.
        
        The provided answer text and citations are preserved exactly as-is, 
        maintaining the authority chain established by the CitationService.
        """
        return AnswerResponse(
            answer=request.answer,
            citations=request.citations,
        )
