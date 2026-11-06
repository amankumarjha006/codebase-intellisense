import asyncio
import sys
import os
from uuid import UUID

# Ensure server module can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "server")))

from app.core.db import SessionLocal
from app.core.config import settings
from app.repositories.repository import RepositoryRepository
from app.repositories.knowledge import KnowledgeRepository
from app.services.embedding.factory import get_embedding_provider
from app.services.embedding.service import EmbeddingService
from app.services.retrieval import (
    RetrievalService,
    SemanticRetrievalStrategy,
    KeywordRetrievalStrategy,
    HybridRetrievalStrategy,
)
from app.services.context.builder import ContextBuilder
from app.services.llm.factory import create_llm_provider
from app.services.rag.service import RAGService
from app.services.citation.service import CitationService
from app.services.answer.service import AnswerService
from app.services.rag_query.service import RAGQueryService
from app.services.rag_query.models import RAGQueryRequest

REPO_ID = UUID("5af31dfa-9e3f-4fcd-a3ac-c7a8e2f14c2c")

async def run_query(query: str):
    print(f"\n=======================================================", flush=True)
    print(f"RUNNING QUERY: {query}", flush=True)
    print(f"=======================================================", flush=True)
    
    db = SessionLocal()
    try:
        repo_repo = RepositoryRepository(db)
        knowledge_repo = KnowledgeRepository(db)
        provider = get_embedding_provider(settings)
        embedding_svc = EmbeddingService(knowledge_repo, provider)
        semantic = SemanticRetrievalStrategy(knowledge_repo, embedding_svc)
        keyword = KeywordRetrievalStrategy(knowledge_repo)
        hybrid = HybridRetrievalStrategy(keyword, semantic)
        retrieval_svc = RetrievalService(hybrid)
        
        context_builder = ContextBuilder()
        llm = create_llm_provider(settings)
        rag_svc = RAGService(llm)
        citation_svc = CitationService()
        answer_svc = AnswerService()
        
        rag_query_svc = RAGQueryService(
            repository_repo=repo_repo,
            retrieval_service=retrieval_svc,
            context_builder=context_builder,
            rag_service=rag_svc,
            citation_service=citation_svc,
            answer_service=answer_svc,
        )
        
        req = RAGQueryRequest(
            repository_id=REPO_ID,
            query=query,
            retrieval_limit=10,
            max_context_chars=16000
        )
        res = await rag_query_svc.execute(req)
        
        print(f"\n--- ANSWER ---", flush=True)
        print(res.answer, flush=True)
        print(f"\n--- CITATIONS ({len(res.citations)}) ---", flush=True)
        for c in res.citations:
            print(f"  [{c.citation_id}] {c.file_path}:{c.start_line}-{c.end_line}", flush=True)
        return res
    finally:
        db.close()

async def main():
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        await run_query(query)
    else:
        print("Please provide a query as arguments.")

if __name__ == "__main__":
    asyncio.run(main())

