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
            try:
                return await provider.generate(prompt, system_instruction)
                
            except TransientLLMError as e:
                provider_type = type(provider).__name__
                model_name = getattr(provider, "model", "unknown")
                logger.warning(
                    f"LLM provider failed transiently; attempting next provider. "
                    f"Provider: {provider_type}, Model: {model_name}, "
                    f"Position: {idx}, Error: {e.__class__.__name__}"
                )
                last_exception = e
                continue
                
            except PermanentLLMError:
                # Permanent errors stop the chain immediately
                raise

        # If we exhausted all providers through transient errors, raise the last one
        if last_exception:
            raise last_exception
            
        raise LLMError("Unknown error occurred, all providers failed without capturing an exception")
