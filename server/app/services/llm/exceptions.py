class LLMError(Exception):
    """Base exception for all LLM provider errors."""
    pass

class TransientLLMError(LLMError):
    """
    Raised for temporary failures that are eligible for fallback.
    Examples: 429, 500, 502, 503, 504, timeouts, provider/model unavailable.
    """
    pass

class PermanentLLMError(LLMError):
    """
    Raised for permanent failures that should NOT trigger fallback.
    Examples: 401, 403, 400 (malformed request), invalid model config.
    """
    pass

class ProviderUnavailableError(TransientLLMError):
    """
    Specifically raised when a provider or model is explicitly unavailable,
    which is treated as a transient/fallback-eligible error.
    """
    pass
