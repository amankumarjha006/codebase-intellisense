import math
from typing import Set, List

def recall_at_k(retrieved_ids: List[str], relevant_ids: Set[str], k: int) -> float:
    """
    Calculate Recall@K.
    If ground truth is empty, returns 0.0 to avoid division by zero.
    """
    if not relevant_ids:
        return 0.0
    top_k = retrieved_ids[:k]
    seen = set()
    hits = 0
    for item_id in top_k:
        if item_id in relevant_ids and item_id not in seen:
            hits += 1
        seen.add(item_id)
    return hits / len(relevant_ids)

def mrr_at_k(retrieved_ids: List[str], relevant_ids: Set[str], k: int) -> float:
    """
    Calculate Mean Reciprocal Rank (MRR) at K.
    Returns 1/rank of the FIRST relevant item found within top K.
    """
    if not relevant_ids:
        return 0.0
    top_k = retrieved_ids[:k]
    for i, item_id in enumerate(top_k):
        if item_id in relevant_ids:
            return 1.0 / (i + 1)
    return 0.0

def ndcg_at_k(retrieved_ids: List[str], relevant_ids: Set[str], k: int) -> float:
    """
    Calculate Normalized Discounted Cumulative Gain (NDCG) at K.
    Uses binary relevance (1 for relevant, 0 for irrelevant).
    """
    if not relevant_ids:
        return 0.0
        
    top_k = retrieved_ids[:k]
    
    # Calculate DCG@K
    dcg = 0.0
    seen = set()
    for i, item_id in enumerate(top_k):
        if item_id in relevant_ids and item_id not in seen:
            # For binary relevance, rel = 1
            dcg += 1.0 / math.log2(i + 2) # rank is i+1, so log2(rank+1) -> log2(i+2)
        seen.add(item_id)
            
    # Calculate IDCG@K (Ideal DCG)
    # The ideal ranking places all relevant items at the very top.
    idcg = 0.0
    ideal_relevant_count = min(len(relevant_ids), k)
    for i in range(ideal_relevant_count):
        idcg += 1.0 / math.log2(i + 2)
        
    if idcg == 0.0:
        return 0.0
        
    return dcg / idcg
