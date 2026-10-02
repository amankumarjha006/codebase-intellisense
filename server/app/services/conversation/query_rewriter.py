from pydantic import BaseModel
from typing import List, Optional
from app.services.llm.provider import LLMProvider

class ConversationMessageContext(BaseModel):
    role: str
    content: str

class ConversationContextRequest(BaseModel):
    current_query: str
    history: List[ConversationMessageContext]

class RewrittenQueryResponse(BaseModel):
    query: str
    was_rewritten: bool

class QueryRewriter:
    def __init__(self, llm_provider: LLMProvider):
        self.llm_provider = llm_provider

    async def rewrite(self, request: ConversationContextRequest) -> RewrittenQueryResponse:
        """
        Rewrites a contextual query into a standalone query using conversation history.
        If rewriting fails or history is empty, falls back to the original query.
        """
        if not request.history:
            return RewrittenQueryResponse(query=request.current_query, was_rewritten=False)

        # Build prompt
        system_instruction = (
            "You are a query rewriting assistant for a codebase semantic search tool. "
            "Your task is to take a user's query and a conversation history, and rewrite the query "
            "so it can be used independently for vector/keyword retrieval.\n\n"
            "Rules:\n"
            "1. Resolve pronouns (it, that, them) to what they refer to in the history.\n"
            "2. Ensure the rewritten query is self-contained and descriptive.\n"
            "3. If the user's query is already standalone, return it mostly unchanged.\n"
            "4. Do NOT answer the question. Only rewrite the query.\n"
            "5. Output ONLY the rewritten query text."
        )

        history_text = ""
        for msg in request.history[-10:]:  # Bound history to last 10 messages
            role = "User" if msg.role == "user" else "Assistant"
            history_text += f"{role}: {msg.content}\n"

        prompt = f"Conversation History:\n{history_text}\nCurrent Query: {request.current_query}\n\nRewritten Query:"

        try:
            rewritten_text = await self.llm_provider.generate(
                prompt=prompt,
                system_instruction=system_instruction
            )
            rewritten_text = rewritten_text.strip()
            if rewritten_text:
                return RewrittenQueryResponse(query=rewritten_text, was_rewritten=True)
            return RewrittenQueryResponse(query=request.current_query, was_rewritten=False)
        except Exception:
            # Fallback to original query on any LLM failure
            return RewrittenQueryResponse(query=request.current_query, was_rewritten=False)
