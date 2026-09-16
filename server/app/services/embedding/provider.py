from typing import Protocol, runtime_checkable

@runtime_checkable
class EmbeddingProvider(Protocol):
    """
    A pure abstraction for embedding generation.
    It accepts a list of string texts and returns a list of embedding vectors.
    """
    def embed(self, texts: list[str]) -> list[list[float]]:
        """
        Embed a list of texts into vectors.
        Must preserve ordering: return vector[i] for texts[i].
        """
        ...
