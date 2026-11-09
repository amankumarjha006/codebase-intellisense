import logging
import time
from typing import List, Optional
import requests
from google import genai
from app.services.embedding.provider import EmbeddingProvider
from app.services.indexing import EmbeddingError
from app.services.embedding.exceptions import (
    EmbeddingProviderError,
    EmbeddingProviderAuthError,
    EmbeddingProviderRateLimitError,
    EmbeddingProviderTimeoutError,
    EmbeddingProviderConnectionError,
    EmbeddingProviderServerError,
    EmbeddingProviderClientError,
)

logger = logging.getLogger(__name__)

class GeminiEmbeddingProvider(EmbeddingProvider):
    """
    Implements the EmbeddingProvider protocol using the official google-genai SDK
    with automatic quota fallback support (e.g. gemini-embedding-2 -> gemini-embedding-001).
    """
    def __init__(
        self,
        api_key: str,
        model: str = "gemini-embedding-2",
        dimension: int = 768,
        fallback_model: Optional[str] = "gemini-embedding-001",
    ):
        self.api_key = api_key
        self.model = model
        self.fallback_model = fallback_model
        self.dimension = dimension
        self.client = None
        self._current_model = model
        self._fallback_until = 0.0

    @property
    def active_model(self) -> str:
        return self._current_model

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        target_model = self.model
        if self.fallback_model and time.time() < self._fallback_until:
            target_model = self.fallback_model

        try:
            self._current_model = target_model
            return self._call_embed(target_model, texts)
        except EmbeddingProviderRateLimitError as e:
            if self.fallback_model and target_model != self.fallback_model:
                cooldown = e.retry_after if e.retry_after and e.retry_after > 0 else 60.0
                self._fallback_until = time.time() + cooldown
                logger.warning(
                    f"Embedding model '{target_model}' rate limited. "
                    f"Falling back to '{self.fallback_model}' for {cooldown:.1f}s..."
                )
                self._current_model = self.fallback_model
                return self._call_embed(self.fallback_model, texts)
            raise

    def _call_embed(self, model: str, texts: list[str]) -> list[list[float]]:
        try:
            if not self.api_key:
                raise EmbeddingError("GEMINI_API_KEY must be provided")

            if self.client is None:
                self.client = genai.Client(api_key=self.api_key)

            # We use embed_content with multiple contents for batching.
            # Using output_dimensionality parameter.
            response = self.client.models.embed_content(
                model=model,
                contents=texts,
                config=genai.types.EmbedContentConfig(
                    output_dimensionality=self.dimension
                )
            )

            # The response.embeddings should be a list in the exact order of the inputs.
            if not response.embeddings or len(response.embeddings) != len(texts):
                raise EmbeddingError(
                    f"Provider returned {len(response.embeddings) if response.embeddings else 0} embeddings, expected {len(texts)}"
                )

            vectors = []
            for emb in response.embeddings:
                vec = list(emb.values)
                if len(vec) != self.dimension:
                    raise EmbeddingError(
                        f"Provider returned vector of dimension {len(vec)}, expected {self.dimension}"
                    )
                vectors.append(vec)

            return vectors
        except EmbeddingError:
            raise
        except genai.errors.APIError as e:
            status_code = getattr(e, 'code', None)
            if status_code is None and getattr(e, 'response', None):
                status_code = getattr(e.response, 'status_code', None)

            if status_code == 429:
                retry_after = None
                # 1. Check response headers
                response = getattr(e, 'response', None)
                if response is not None and hasattr(response, 'headers') and response.headers:
                    retry_hdr = response.headers.get("Retry-After") or response.headers.get("retry-after")
                    if retry_hdr is not None:
                        try:
                            retry_after = float(retry_hdr)
                        except (ValueError, TypeError):
                            pass

                # 2. Check for retryDelay in details if header was not present
                if retry_after is None and getattr(e, 'details', None):
                    details = e.details
                    details_list = []
                    if isinstance(details, dict):
                        error_obj = details.get("error", {})
                        if isinstance(error_obj, dict) and "details" in error_obj:
                            details_list = error_obj.get("details", [])
                        elif "details" in details:
                            details_list = details.get("details", [])
                    elif isinstance(details, list):
                        details_list = details

                    if isinstance(details_list, list):
                        for detail in details_list:
                            if isinstance(detail, dict) and detail.get("@type") == "type.googleapis.com/google.rpc.RetryInfo":
                                delay = detail.get("retryDelay")
                                if isinstance(delay, str) and delay.endswith("s"):
                                    try:
                                        retry_after = float(delay[:-1])
                                        break
                                    except (ValueError, TypeError):
                                        pass
                                elif isinstance(delay, dict):
                                    try:
                                        secs = float(delay.get("seconds", 0))
                                        nanos = float(delay.get("nanos", 0)) / 1e9
                                        retry_after = secs + nanos
                                        break
                                    except (ValueError, TypeError):
                                        pass
                                elif isinstance(delay, (int, float)):
                                    retry_after = float(delay)
                                    break

                raise EmbeddingProviderRateLimitError(str(e), retry_after) from e
            elif status_code == 408:
                raise EmbeddingProviderTimeoutError(str(e)) from e
            elif status_code in (401, 403):
                raise EmbeddingProviderAuthError(str(e)) from e
            elif status_code is not None and 400 <= status_code < 500:
                raise EmbeddingProviderClientError(str(e)) from e
            elif status_code is not None and 500 <= status_code < 600:
                raise EmbeddingProviderServerError(str(e)) from e
            else:
                raise EmbeddingProviderError(f"Gemini API Error: {str(e)}") from e
        except requests.exceptions.Timeout as e:
            raise EmbeddingProviderTimeoutError(f"Connection timeout: {str(e)}") from e
        except requests.exceptions.ConnectionError as e:
            raise EmbeddingProviderConnectionError(f"Connection error: {str(e)}") from e
        except requests.exceptions.SSLError as e:
            raise EmbeddingProviderConnectionError(f"SSL error: {str(e)}") from e
        except requests.exceptions.RequestException as e:
            raise EmbeddingProviderError(f"Request failed: {str(e)}") from e
        except Exception as e:
            raise EmbeddingProviderError(f"Unexpected error: {str(e)}") from e
