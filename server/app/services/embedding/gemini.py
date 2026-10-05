from typing import List
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
        except genai.errors.APIError as e:
            status_code = getattr(e, 'code', None)
            if status_code is None and getattr(e, 'response', None):
                status_code = e.response.status_code

            if status_code == 429:
                retry_after = None
                if getattr(e, 'response', None) and hasattr(e.response, 'headers'):
                    retry_hdr = e.response.headers.get("Retry-After")
                    if retry_hdr:
                        try:
                            retry_after = float(retry_hdr)
                        except ValueError:
                            pass

                # Check for retryDelay in details
                if getattr(e, 'details', None) and isinstance(e.details, dict):
                    details_list = e.details.get("error", {}).get("details", [])
                    if not details_list and "details" in e.details:
                        details_list = e.details["details"]
                    for detail in details_list:
                        if detail.get("@type") == "type.googleapis.com/google.rpc.RetryInfo":
                            delay_str = detail.get("retryDelay", "")
                            if delay_str.endswith("s"):
                                try:
                                    retry_after = float(delay_str[:-1])
                                except ValueError:
                                    pass
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
