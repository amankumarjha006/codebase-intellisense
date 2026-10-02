import logging
from typing import List

from app.services.llm.provider import LLMProvider
from app.services.llm.exceptions import (
    LLMError,
    TransientLLMError,
    PermanentLLMError
)

logger = logging.getLogger(__name__)

class FallbackLLMProvider(LLMProvider):
    def __init__(self, providers: List[LLMProvider]):
        if not providers:
            raise ValueError("FallbackLLMProvider requires at least one provider")
        self.providers = providers

    async def generate(self, prompt: str, system_instruction: str | None = None) -> str:
        last_exception = None
        
        for idx, provider in enumerate(self.providers):
            provider_type = type(provider).__name__
            model_name = getattr(provider, "model", "unknown")
            try:
                result = await provider.generate(prompt, system_instruction)
                logger.info("llm_operation", extra={
                    "operation": "generate",
                    "provider": provider_type,
                    "model": model_name,
                    "status": "success",
                    "attempt": idx + 1
                })
                return result
                
            except TransientLLMError as e:
                logger.warning(
                    "llm_operation", extra={
                        "operation": "generate",
                        "provider": provider_type,
                        "model": model_name,
                        "status": "transient_failure",
                        "error_type": type(e).__name__,
                        "attempt": idx + 1
                    }
                )
                last_exception = e
                continue
                
            except PermanentLLMError as e:
                logger.error(
                    "llm_operation", extra={
                        "operation": "generate",
                        "provider": provider_type,
                        "model": model_name,
                        "status": "permanent_failure",
                        "error_type": type(e).__name__,
                        "attempt": idx + 1
                    }
                )
                # Permanent errors stop the chain immediately
                raise

        # If we exhausted all providers through transient errors, raise the last one
        if last_exception:
            logger.error("llm_operation_exhausted", extra={"operation": "generate", "error_type": "TransientLLMError"})
            raise last_exception
            
        raise LLMError("Unknown error occurred, all providers failed without capturing an exception")

    async def stream(self, prompt: str, system_instruction: str | None = None):
        last_exception = None
        
        for idx, provider in enumerate(self.providers):
            provider_type = type(provider).__name__
            model_name = getattr(provider, "model", "unknown")
            try:
                # We do not log 'success' here because it succeeds on every chunk.
                # The upstream streaming service logs first token.
                async for chunk in provider.stream(prompt, system_instruction):
                    yield chunk
                return
                
            except TransientLLMError as e:
                logger.warning(
                    "llm_operation", extra={
                        "operation": "stream",
                        "provider": provider_type,
                        "model": model_name,
                        "status": "transient_failure",
                        "error_type": type(e).__name__,
                        "attempt": idx + 1
                    }
                )
                last_exception = e
                continue
                
            except PermanentLLMError as e:
                logger.error(
                    "llm_operation", extra={
                        "operation": "stream",
                        "provider": provider_type,
                        "model": model_name,
                        "status": "permanent_failure",
                        "error_type": type(e).__name__,
                        "attempt": idx + 1
                    }
                )
                raise

        if last_exception:
            logger.error("llm_operation_exhausted", extra={"operation": "stream", "error_type": "TransientLLMError"})
            raise last_exception
            
        raise LLMError("Unknown error occurred, all providers failed without capturing an exception")
