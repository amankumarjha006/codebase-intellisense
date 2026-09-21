import pytest
from eval.metrics import recall_at_k, mrr_at_k, ndcg_at_k

def test_recall_at_k():
    retrieved = ["a", "b", "c", "d"]
    
    # 2 relevant in top 2, out of 2 total -> 2/2 = 1.0
    assert recall_at_k(retrieved, {"a", "b"}, 2) == 1.0
    
    # 1 relevant in top 2, out of 2 total -> 1/2 = 0.5
    assert recall_at_k(retrieved, {"b", "c"}, 2) == 0.5
    
    # relevant outside K
    assert recall_at_k(retrieved, {"d"}, 2) == 0.0
    
    # no relevant items retrieved
    assert recall_at_k(retrieved, {"z"}, 4) == 0.0
    
    # empty ground truth
    assert recall_at_k(retrieved, set(), 4) == 0.0
    
    # empty retrieved
    assert recall_at_k([], {"a"}, 4) == 0.0

def test_mrr_at_k():
    retrieved = ["a", "b", "c", "d"]
    
    # First relevant at rank 1 -> 1.0
    assert mrr_at_k(retrieved, {"a"}, 4) == 1.0
    assert mrr_at_k(retrieved, {"a", "c"}, 4) == 1.0
    
    # First relevant at rank 2 -> 0.5
    assert mrr_at_k(retrieved, {"b"}, 4) == 0.5
    assert mrr_at_k(retrieved, {"b", "c"}, 4) == 0.5
    
    # First relevant outside K -> 0.0
    assert mrr_at_k(retrieved, {"c"}, 2) == 0.0
    
    # No relevant items -> 0.0
    assert mrr_at_k(retrieved, {"z"}, 4) == 0.0
    
    # Empty ground truth -> 0.0
    assert mrr_at_k(retrieved, set(), 4) == 0.0

def test_ndcg_at_k():
    retrieved = ["a", "b", "c", "d"]
    
    import math
    
    # Ideal case: top 2 are the 2 relevant items
    assert ndcg_at_k(retrieved, {"a", "b"}, 2) == 1.0
    
    # Relevant item at rank 2
    # DCG = 1 / log2(3) = 0.6309
    # IDCG = 1 / log2(2) = 1.0
    # NDCG = 0.6309 / 1.0
    expected = (1.0 / math.log2(3)) / (1.0 / math.log2(2))
    assert ndcg_at_k(retrieved, {"b"}, 2) == pytest.approx(expected)
    
    # Relevant item at rank 1 and 3, but K=2
    # In top 2, only rank 1 is retrieved.
    # DCG = 1 / log2(2) = 1.0
    # IDCG = 1/log2(2) + 1/log2(3) = 1.0 + 0.6309 = 1.6309
    expected = (1.0) / (1.0 + 1.0 / math.log2(3))
    assert ndcg_at_k(retrieved, {"a", "c"}, 2) == pytest.approx(expected)
    
    # No relevant items -> 0.0
    assert ndcg_at_k(retrieved, {"z"}, 4) == 0.0
    
    # Empty ground truth -> 0.0
    assert ndcg_at_k(retrieved, set(), 4) == 0.0

def test_recall_at_k_duplicate_relevant():
    # Duplicate retrieved items shouldn't inflate recall
    retrieved = ["A", "A", "B"]
    ground_truth = {"A", "B"}
    assert recall_at_k(retrieved, ground_truth, 3) == 1.0

def test_recall_at_k_duplicate_irrelevant():
    retrieved = ["A", "X", "X", "Y"]
    ground_truth = {"A", "B"}
    # A is relevant (hits=1). B is missing. Total relevant=2. Recall=0.5
    assert recall_at_k(retrieved, ground_truth, 4) == 0.5

def test_ndcg_at_k_duplicate():
    import math
    retrieved = ["A", "A", "B", "C"]
    ground_truth = {"A", "B", "C"}
    
    # K = 4
    # Unique retrieved semantics: A (rank 1), B (rank 3), C (rank 4).
    # The duplicate A at rank 2 is ignored.
    # DCG = 1/log2(2) + 1/log2(4) + 1/log2(5)
    dcg = (1.0 / math.log2(2)) + (1.0 / math.log2(4)) + (1.0 / math.log2(5))
    
    # IDCG for 3 relevant items out of K=4
    # Ideal: rank 1, 2, 3
    idcg = (1.0 / math.log2(2)) + (1.0 / math.log2(3)) + (1.0 / math.log2(4))
    
    assert ndcg_at_k(retrieved, ground_truth, 4) == pytest.approx(dcg / idcg)
