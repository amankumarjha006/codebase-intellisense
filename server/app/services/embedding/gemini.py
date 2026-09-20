from typing import List
from google import genai
from app.services.embedding.provider import EmbeddingProvider
from app.services.indexing import EmbeddingError

class GeminiEmbeddingProvider(EmbeddingProvider):
    """
    Implements the EmbeddingProvider protocol using the official google-genai SDK.
    """
    def __init__(self, api_key: str, model: str, dimension: int):
        self.api_key = api_key
        self.model = model
        self.dimension = dimension
        self.client = None

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
            
        try:
            if not self.api_key:
                raise EmbeddingError("GEMINI_API_KEY must be provided")
                
            if self.client is None:
                self.client = genai.Client(api_key=self.api_key)
                
            # We use embed_content with multiple contents for batching.
            # Using output_dimensionality parameter.
            response = self.client.models.embed_content(
                model=self.model,
                contents=texts,
                config=genai.types.EmbedContentConfig(
                    output_dimensionality=self.dimension
                )
            )
            
            # The response.embeddings should be a list in the exact order of the inputs.
            # We extract the float arrays.
            if not response.embeddings or len(response.embeddings) != len(texts):
                raise EmbeddingError(f"Provider returned {len(response.embeddings) if response.embeddings else 0} embeddings, expected {len(texts)}")
                
            vectors = []
            for emb in response.embeddings:
                # Assuming emb.values contains the float list
                vec = list(emb.values)
                if len(vec) != self.dimension:
                    raise EmbeddingError(f"Provider returned vector of dimension {len(vec)}, expected {self.dimension}")
                vectors.append(vec)
                
            return vectors
        except EmbeddingError:
            raise
        except Exception as e:
            raise EmbeddingError(f"Gemini API embedding failed: {str(e)}") from e
