from typing import Protocol, AsyncGenerator

class LLMProvider(Protocol):
    async def generate(
        self,
        prompt: str,
        system_instruction: str | None = None,
    ) -> str:
        """
        Generate text from the LLM provider.
        
        Args:
            prompt: The user prompt to generate text for.
            system_instruction: Optional system instructions for the LLM.
            
        Returns:
            The generated text string.
            
        Raises:
            TransientLLMError: For temporary/fallback-eligible errors.
            PermanentLLMError: For fatal/non-fallback errors.
        """
    async def stream(
        self,
        prompt: str,
        system_instruction: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """
        Stream generated text from the LLM provider.
        """
        ...
