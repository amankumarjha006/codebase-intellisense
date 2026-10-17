import json
import os
import hashlib
from pathlib import Path
from typing import List, Union
from app.services.embedding.provider import EmbeddingProvider

DEFAULT_CACHE_PATH = Path(__file__).resolve().parent / "query_embeddings_cache.json"

class CachedEmbeddingProvider(EmbeddingProvider):
    """
    Wraps an existing EmbeddingProvider to cache generated embeddings locally.
    This prevents unnecessary Gemini API calls during repeated evaluation runs.
    """
    def __init__(
        self,
        provider: EmbeddingProvider,
        model: str,
        dimension: int,
        cache_path: Union[str, Path, None] = None,
    ):
        self.provider = provider
        self.model = model
        self.dimension = dimension
        self.cache_path = Path(cache_path) if cache_path is not None else DEFAULT_CACHE_PATH
        self._cache = self._load_cache()
        
    def _load_cache(self) -> dict:
        if self.cache_path.exists():
            try:
                with open(self.cache_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except json.JSONDecodeError:
                raise ValueError(f"Cache file {self.cache_path} is corrupted. Please delete or fix it.")
        return {}
        
    def _save_cache(self):
        # Ensure directory exists
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        # Write to temp file then rename for atomic safety
        temp_path = self.cache_path.with_name(f"{self.cache_path.name}.tmp")
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(self._cache, f, indent=2)
        os.replace(temp_path, self.cache_path)
        
    def _generate_key(self, text: str) -> str:
        # Create a safe key incorporating model, dimension, and query
        raw_key = f"{self.model}:{self.dimension}:{text}"
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    def embed(self, texts: List[str]) -> List[List[float]]:
        results = []
        needs_save = False
        
        # Determine which texts need real embedding
        uncached_texts = []
        text_to_key = {}
        for text in texts:
            key = self._generate_key(text)
            text_to_key[text] = key
            if key not in self._cache:
                uncached_texts.append(text)
                
        # Fetch uncached embeddings
        if uncached_texts:
            new_vectors = self.provider.embed(uncached_texts)
            for text, vector in zip(uncached_texts, new_vectors):
                key = text_to_key[text]
                self._cache[key] = vector
            needs_save = True
            
        if needs_save:
            self._save_cache()
            
        # Reconstruct full result in original order
        for text in texts:
            key = text_to_key[text]
            results.append(self._cache[key])
            
        return results
