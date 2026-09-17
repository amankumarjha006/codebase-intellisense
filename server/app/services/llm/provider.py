from typing import Protocol

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
        ...
