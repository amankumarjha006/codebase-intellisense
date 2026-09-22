"""
Provider-independent RAG Generation Service.
"""
from app.services.llm.provider import LLMProvider
from app.services.rag.models import RAGRequest, RAGResponse
from app.services.rag.prompt import PromptBuilder

class RAGService:
    """
    Orchestrates RAG generation by constructing a prompt and calling
    the provided LLM abstraction.
    """
    
    def __init__(self, llm_provider: LLMProvider):
        self.llm_provider = llm_provider
        self.prompt_builder = PromptBuilder()

    async def answer_query(self, request: RAGRequest) -> RAGResponse:
        """
        Generates an answer from the context using the LLM provider.
        
        Raises LLMError (TransientLLMError, PermanentLLMError) if the provider chain fails.
        """
        prompt, system_instruction = self.prompt_builder.build(request)
        
        # Invoke the LLM provider exactly matching its Protocol
        answer = await self.llm_provider.generate(
            prompt=prompt,
            system_instruction=system_instruction
        )
        
        # Return response preserving full provenance
        return RAGResponse(
            answer=answer,
            context_items=tuple(request.context.items)
        )
