import argparse
import json
import sys
from typing import Dict, List, Set, Any
from uuid import UUID

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.repository import Repository, RepositoryVersion
from app.models.knowledge import File, CodeChunk
from app.repositories.knowledge import KnowledgeRepository
from app.services.retrieval.models import RetrievalRequest, RetrievalResult
from app.services.retrieval.strategies import (
    KeywordRetrievalStrategy,
    SemanticRetrievalStrategy,
    HybridRetrievalStrategy,
)
from app.services.embedding.service import EmbeddingService
from app.services.embedding.gemini import GeminiEmbeddingProvider
from eval.cached_embedding_provider import CachedEmbeddingProvider
from eval.metrics import recall_at_k, mrr_at_k, ndcg_at_k

K_VALUES = [5, 10, 20]

def load_dataset(dataset_path: str) -> List[dict]:
    try:
        queries = []
        with open(dataset_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                queries.append(json.loads(line))
        return queries
    except FileNotFoundError:
        print(f"Error: Dataset {dataset_path} not found.")
        sys.exit(1)

def resolve_repository_version(db: Session, owner: str, name: str, commit_sha: str) -> RepositoryVersion:
    repo = db.query(Repository).filter_by(owner=owner, name=name).first()
    if not repo:
        print(f"Error: Repository {owner}/{name} not found in database.")
        sys.exit(1)
        
    version = db.query(RepositoryVersion).filter_by(repository_id=repo.id, commit_sha=commit_sha).first()
    if not version:
        print(f"Error: RepositoryVersion for commit {commit_sha} not found in database.")
        print(f"The evaluation dataset targets a specific snapshot that is not currently indexed.")
        sys.exit(1)
        
    if version.index_status != "SUCCESS":
        print(f"Error: RepositoryVersion {commit_sha} is not in SUCCESS status (current: {version.index_status}).")
        sys.exit(1)
        
    return version

def resolve_ground_truth(db: Session, version_id: UUID, relevant_chunks: List[dict]) -> Set[str]:
    """
    Maps file_path + chunk_index to the actual code_chunk_id.
    """
    code_chunk_ids = set()
    for chunk_ref in relevant_chunks:
        file_path = chunk_ref["file_path"]
        chunk_index = chunk_ref["chunk_index"]
        
        file = db.query(File).filter_by(repository_version_id=version_id, file_path=file_path).first()
        if not file:
            print(f"Error: Ground truth file {file_path} not found in repository version.")
            sys.exit(1)
            
        chunk = db.query(CodeChunk).filter_by(file_id=file.id, chunk_index=chunk_index).first()
        if not chunk:
            print(f"Error: Ground truth chunk_index {chunk_index} for file {file_path} not found.")
            sys.exit(1)
            
        code_chunk_ids.add(str(chunk.id))
        
    return code_chunk_ids

def run_evaluation(dataset_path: str, verbose: bool):
    engine = create_engine(settings.DATABASE_URL)
    db = Session(engine)
    
    queries = load_dataset(dataset_path)
    if not queries:
        print("Dataset is empty.")
        return
        
    print(f"Loaded {len(queries)} queries.")
    
    # Initialize strategies
    knowledge_repo = KnowledgeRepository(db)
    
    raw_provider = GeminiEmbeddingProvider(
        api_key=settings.GEMINI_API_KEY,
        model=settings.EMBEDDING_MODEL,
        dimension=settings.EMBEDDING_DIMENSION,
    )
    cached_provider = CachedEmbeddingProvider(
        provider=raw_provider,
        model=settings.EMBEDDING_MODEL,
        dimension=settings.EMBEDDING_DIMENSION,
    )
    embedding_service = EmbeddingService(knowledge_repo, cached_provider)
    
    keyword_strategy = KeywordRetrievalStrategy(knowledge_repo)
    semantic_strategy = SemanticRetrievalStrategy(knowledge_repo, embedding_service)
    hybrid_strategy = HybridRetrievalStrategy(keyword_strategy, semantic_strategy)
    
    strategies = {
        "Keyword": keyword_strategy,
        "Semantic": semantic_strategy,
        "Hybrid": hybrid_strategy,
    }
    
    # Metrics storage
    # strategy -> metric_name -> sum
    aggregated_metrics = {s: {f"{m}@{k}": 0.0 for m in ["Recall", "MRR", "NDCG"] for k in K_VALUES} for s in strategies}
    
    # Keep track of repo details for the final report
    repo_owner = None
    repo_name = None
    commit_sha = None
    
    for q_idx, q in enumerate(queries, start=1):
        if verbose:
            print(f"\n--- Query {q_idx}: {q['query']}")
            
        # 1. Resolve version
        r_metadata = q["repository"]
        if repo_owner is None:
            repo_owner, repo_name, commit_sha = r_metadata["owner"], r_metadata["name"], r_metadata["commit_sha"]
            
        version = resolve_repository_version(db, r_metadata["owner"], r_metadata["name"], r_metadata["commit_sha"])
        
        # 2. Resolve ground truth
        gt_chunk_ids = resolve_ground_truth(db, version.id, q.get("relevant_chunks", []))
        
        if not gt_chunk_ids:
            print(f"Warning: Query {q.get('query_id')} has no relevant chunks. Skipping.")
            continue
            
        # 3. Evaluate each strategy
        req = RetrievalRequest(
            repository_version_id=version.id,
            query=q["query"],
            limit=20
        )
        
        for strategy_name, strategy in strategies.items():
            results = strategy.retrieve(req)
            retrieved_ids = [str(r.code_chunk_id) for r in results]
            
            for k in K_VALUES:
                rec = recall_at_k(retrieved_ids, gt_chunk_ids, k)
                mrr = mrr_at_k(retrieved_ids, gt_chunk_ids, k)
                ndcg = ndcg_at_k(retrieved_ids, gt_chunk_ids, k)
                
                aggregated_metrics[strategy_name][f"Recall@{k}"] += rec
                aggregated_metrics[strategy_name][f"MRR@{k}"] += mrr
                aggregated_metrics[strategy_name][f"NDCG@{k}"] += ndcg
                
            if verbose:
                first_rel = mrr_at_k(retrieved_ids, gt_chunk_ids, 20)
                first_rel_rank = int(1.0 / first_rel) if first_rel > 0 else "N/A"
                print(f"{q.get('query_id', 'q')} | {strategy_name:<8} | first relevant rank: {first_rel_rank}")
                
    # 4. Print Report
    print("\n" + "="*80)
    print(" EVALUATION REPORT")
    print("="*80)
    print(f"Queries evaluated : {len(queries)}")
    print(f"Repository        : {repo_owner}/{repo_name}")
    print(f"Commit SHA        : {commit_sha}")
    print(f"Embedding model   : {settings.EMBEDDING_MODEL}")
    print("-" * 80)
    
    # Print Table Header
    cols = ["Strategy"]
    for m in ["Recall", "MRR", "NDCG"]:
        for k in K_VALUES:
            cols.append(f"{m}@{k}")
            
    header = "| " + " | ".join(cols) + " |"
    divider = "|---" + "|---:" * (len(cols) - 1) + "|"
    print(header)
    print(divider)
    
    for strategy_name in ["Keyword", "Semantic", "Hybrid"]:
        row = [f"{strategy_name}"]
        for m in ["Recall", "MRR", "NDCG"]:
            for k in K_VALUES:
                mean_val = aggregated_metrics[strategy_name][f"{m}@{k}"] / len(queries)
                row.append(f"{mean_val:.3f}")
        print("| " + " | ".join(row) + " |")
        
    print("="*80)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run retrieval evaluation benchmark.")
    parser.add_argument("--dataset", type=str, default="server/eval/dataset.jsonl", help="Path to dataset JSONL")
    parser.add_argument("--verbose", action="store_true", help="Print per-query diagnostics")
    args = parser.parse_args()
    
    run_evaluation(args.dataset, args.verbose)
