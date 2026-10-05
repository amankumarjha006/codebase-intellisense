class EmbeddingProviderError(Exception):
    """Base class for all embedding provider errors."""
    pass

class EmbeddingProviderAuthError(EmbeddingProviderError):
    """Raised when authentication with the provider fails."""
    pass

class EmbeddingProviderRateLimitError(EmbeddingProviderError):
    """Raised when the provider rate limits requests (HTTP 429)."""
    def __init__(self, message: str, retry_after: float | None = None):
        super().__init__(message)
        self.retry_after = retry_after

class EmbeddingProviderTimeoutError(EmbeddingProviderError):
    """Raised when a request to the provider times out (HTTP 408 or connection timeout)."""
    pass

class EmbeddingProviderConnectionError(EmbeddingProviderError):
    """Raised when there is a connection/SSL error with the provider."""
    pass

class EmbeddingProviderServerError(EmbeddingProviderError):
    """Raised when the provider returns a 5xx error."""
    pass

class EmbeddingProviderClientError(EmbeddingProviderError):
    """Raised when the provider returns a 4xx error (other than 429 or 408)."""
    pass
