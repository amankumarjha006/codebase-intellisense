import json
import logging
import uuid
from uuid import UUID
from typing import AsyncGenerator
import redis.asyncio as redis

from app.core.retry import RetryExecutor

from app.models.conversation import Message, Citation
from app.repositories.conversation import ConversationRepository
from app.repositories.message import MessageRepository
from app.repositories.repository import RepositoryRepository
from app.services.retrieval.service import RetrievalService
from app.services.retrieval.models import RetrievalRequest
from app.services.context.builder import ContextBuilder
from app.services.context.models import ContextRequest
from app.services.rag.service import RAGService
from app.services.rag.models import RAGRequest
from app.services.citation.service import CitationService
from app.services.citation.models import CitationRequest
from app.services.answer.service import AnswerService
from app.services.answer.models import AnswerRequest

from app.services.conversation.query_rewriter import QueryRewriter, ConversationContextRequest, ConversationMessageContext
from app.schemas.message import ConversationMessageRequest
from app.services.rag_query.exceptions import (
    NoIndexedVersionError,
    InvalidRepositoryVersionError
)
from app.services.llm.exceptions import TransientLLMError, PermanentLLMError

logger = logging.getLogger(__name__)

class ConversationStreamingService:
    def __init__(
        self,
        conversation_repo: ConversationRepository,
        message_repo: MessageRepository,
        repository_repo: RepositoryRepository,
        query_rewriter: QueryRewriter,
        retrieval_service: RetrievalService,
        context_builder: ContextBuilder,
        rag_service: RAGService,
        citation_service: CitationService,
        answer_service: AnswerService,
        redis_client: redis.Redis,
    ):
        self.conversation_repo = conversation_repo
        self.message_repo = message_repo
        self.repository_repo = repository_repo
        self.query_rewriter = query_rewriter
        self.retrieval_service = retrieval_service
        self.context_builder = context_builder
        self.rag_service = rag_service
        self.citation_service = citation_service
        self.answer_service = answer_service
        self.redis_client = redis_client

    async def stream_message(
        self,
        user_id: UUID,
        conversation_id: UUID,
        request: ConversationMessageRequest
    ) -> AsyncGenerator[str, None]:
        
        import time
        stream_start_time = time.perf_counter()
        
        logger.info("stream_started", extra={
            "conversation_id": str(conversation_id),
            "user_id": str(user_id)
        })

        lock_key = f"conv_lock:{conversation_id}"
        lock_token = str(uuid.uuid4())
        lock_acquired = False
        
        logger.debug("conversation_lock_attempt", extra={
            "conversation_id": str(conversation_id)
        })

        try:
            # 1. Acquire Lock securely
            lock_acquired = await self.redis_client.set(lock_key, lock_token, nx=True, ex=60)
            if not lock_acquired:
                logger.warning("conversation_lock_contended", extra={
                    "conversation_id": str(conversation_id)
                })
                yield self._format_sse("error", {"code": "CONVERSATION_GENERATION_IN_PROGRESS", "message": "A response is currently being generated for this conversation."})
                return
                
            logger.debug("conversation_lock_acquired", extra={
                "conversation_id": str(conversation_id)
            })

            # 2. Validate Conversation
            conversation = self.conversation_repo.get_for_user(conversation_id, user_id)
            if not conversation:
                yield self._format_sse("error", {"code": "NOT_FOUND", "message": f"Conversation {conversation_id} not found."})
                return

            # Validate pinned version
            version_id = conversation.repository_version_id
            version = self.repository_repo.get_version_by_id(version_id)
            if not version or version.index_status != "SUCCESS":
                yield self._format_sse("error", {"code": "INVALID_REQUEST", "message": f"Version {version_id} is invalid or not successfully indexed."})
                return

            # 3. Persist User Message (TX1)
            user_msg = Message(
                conversation_id=conversation.id,
                role="user",
                content=request.content
            )
            user_msg = self.message_repo.create(user_msg)
            
            yield self._format_sse("message_start", {
                "message_id": str(user_msg.id),
                "conversation_id": str(conversation.id),
                "repository_version_id": str(version_id)
            })

            # 4. Load bounded history
            all_msgs, _ = self.message_repo.list_for_conversation(conversation.id, skip=0, limit=20)
            history = [
                ConversationMessageContext(role=m.role, content=m.content) 
                for m in all_msgs if m.id != user_msg.id
            ]

            retry_executor = RetryExecutor(max_retries=2, initial_backoff=1.0)
            
            # 5. Rewrite query (with retries)
            rewrite_req = ConversationContextRequest(
                current_query=request.content,
                history=history
            )
            
            rewrite_start = time.perf_counter()
            rewrite_res = await retry_executor.execute(
                lambda: self.query_rewriter.rewrite(rewrite_req)
            )
            retrieval_query = rewrite_res.query
            
            logger.info("rag_query_rewritten", extra={
                "duration_ms": round((time.perf_counter() - rewrite_start) * 1000, 2),
                "conversation_id": str(conversation_id)
            })

            # 6. Retrieve
            retrieval_start = time.perf_counter()
            retrieval_req = RetrievalRequest(
                repository_version_id=version_id,
                query=retrieval_query,
                limit=10  # use default or config
            )
            retrieval_results = self.retrieval_service.search(retrieval_req)
            
            logger.info("rag_retrieval", extra={
                "duration_ms": round((time.perf_counter() - retrieval_start) * 1000, 2),
                "count": len(retrieval_results.chunks),
                "conversation_id": str(conversation_id)
            })

            # 7. Context Builder
            context_req = ContextRequest(
                query=retrieval_query,
                retrieval_results=retrieval_results,
                max_context_chars=12000
            )
            assembled_context = self.context_builder.build(context_req)

            # 8. RAG LLM Stream
            rag_req = RAGRequest(
                query=request.content, # Pass original query to LLM to ground the answer
                context=assembled_context
            )
            
            async def get_stream_and_first_chunk():
                stream_generator = self.rag_service.stream_answer_query(rag_req)
                try:
                    first_chunk = await stream_generator.__anext__()
                except StopAsyncIteration:
                    first_chunk = ""
                return stream_generator, first_chunk
                
            stream_generator, first_chunk = await retry_executor.execute(get_stream_and_first_chunk)
            
            full_answer = []
            if first_chunk:
                full_answer.append(first_chunk)
                yield self._format_sse("token", {"text": first_chunk})
                
                first_token_latency = round((time.perf_counter() - stream_start_time) * 1000, 2)
                logger.info("stream_first_token", extra={
                    "conversation_id": str(conversation_id),
                    "first_token_latency_ms": first_token_latency
                })

            # For subsequent chunks, we are past the point of safe retries.
            # If a TransientLLMError occurs here, it will bubble up and emit an SSE error.
            async for chunk in stream_generator:
                full_answer.append(chunk)
                yield self._format_sse("token", {"text": chunk})

            generated_text = "".join(full_answer)

            # 9. Extract Citations
            citation_req = CitationRequest(
                answer=generated_text,
                context_items=tuple(assembled_context.items)
            )
            citation_res = self.citation_service.create_citations(citation_req)

            # 10. Assemble Final Answer
            answer_req = AnswerRequest(
                answer=generated_text,
                citations=citation_res.citations
            )
            answer_res = self.answer_service.assemble(answer_req)

            # 11. Persist Assistant Message (TX2)
            assistant_msg = Message(
                conversation_id=conversation.id,
                role="assistant",
                content=answer_res.answer
            )
            
            db_citations = []
            for c in answer_res.citations:
                db_citations.append(
                    Citation(
                        code_chunk_id=c.code_chunk_id,
                        file_path=c.file_path,
                        start_line=c.start_line,
                        end_line=c.end_line
                    )
                )
            assistant_msg.citations = db_citations
            assistant_msg = self.message_repo.create(assistant_msg)

            # 12. Emit final events
            for c in answer_res.citations:
                yield self._format_sse("citation", {
                    "citation_id": c.citation_id,
                    "file_path": c.file_path,
                    "start_line": c.start_line,
                    "end_line": c.end_line
                })

            yield self._format_sse("message_complete", {
                "message_id": str(assistant_msg.id),
                "conversation_id": str(conversation.id),
                "repository_version_id": str(version_id)
            })
            
            logger.info("stream_completed", extra={
                "conversation_id": str(conversation_id),
                "duration_ms": round((time.perf_counter() - stream_start_time) * 1000, 2)
            })

        except TransientLLMError as e:
            logger.warning("stream_failed", extra={"conversation_id": str(conversation_id), "error_type": type(e).__name__})
            yield self._format_sse("error", {"code": "UPSTREAM_SERVICE_UNAVAILABLE", "message": str(e)})
        except PermanentLLMError as e:
            logger.error("stream_failed", extra={"conversation_id": str(conversation_id), "error_type": type(e).__name__})
            yield self._format_sse("error", {"code": "UPSTREAM_SERVICE_ERROR", "message": str(e)})
        except Exception as e:
            logger.exception("Streaming generation failed", extra={"conversation_id": str(conversation_id), "error_type": type(e).__name__})
            yield self._format_sse("error", {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred during generation."})
        finally:
            if lock_acquired:
                # Safe lock release using Lua script
                lua_script = """
                if redis.call("get", KEYS[1]) == ARGV[1] then
                    return redis.call("del", KEYS[1])
                else
                    return 0
                end
                """
                released = await self.redis_client.eval(lua_script, 1, lock_key, lock_token)
                if not released:
                    logger.warning("conversation_lock_expiration", extra={
                        "conversation_id": str(conversation_id),
                        "message": "Lock expired before generation completed"
                    })
                else:
                    logger.debug("conversation_lock_released", extra={
                        "conversation_id": str(conversation_id)
                    })

    def _format_sse(self, event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data)}\n\n"
