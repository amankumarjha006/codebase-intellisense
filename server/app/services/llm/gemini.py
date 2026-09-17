from google import genai
from google.genai.errors import APIError

from app.services.llm.exceptions import (
    LLMError,
    TransientLLMError,
    PermanentLLMError,
    ProviderUnavailableError,
)
from app.services.llm.provider import LLMProvider

class GeminiLLMProvider(LLMProvider):
    def __init__(self, api_key: str | None, model: str):
        self.model = model
        
        if not api_key:
            raise PermanentLLMError("GEMINI_API_KEY must be provided")
            
        try:
            self.client = genai.Client(api_key=api_key)
        except Exception as e:
            raise PermanentLLMError(f"Failed to initialize Gemini client: {str(e)}") from e

    async def generate(self, prompt: str, system_instruction: str | None = None) -> str:
        try:
            # Prepare config if system instruction exists
            config = None
            if system_instruction:
                config = genai.types.GenerateContentConfig(
                    system_instruction=system_instruction
                )
                
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=prompt,
                config=config,
            )
            
            if not response or not response.text:
                raise PermanentLLMError("Received empty or malformed response from Gemini")
                
            return response.text
            
        except APIError as e:
            # Map google-genai APIError to Transient or Permanent
            status_code = getattr(e, "code", getattr(e, "status_code", None))
            
            # Treat 429, 500+ as transient
            if status_code in (429, 500, 502, 503, 504):
                raise TransientLLMError(f"Gemini transient API error {status_code}") from e
                
            # Model not found or model unavailable handling
            # In google-genai, model availability/not found might be 400 or 404.
            # E.g. "models/gemini-3.8-flash not found"
            error_message = str(e).lower()
            if status_code == 404 and "not found" in error_message:
                raise ProviderUnavailableError(f"Model {self.model} not found or unavailable") from e
                
            if "unavailable" in error_message or "overloaded" in error_message or "capacity" in error_message:
                raise TransientLLMError(f"Gemini temporarily unavailable: {str(e)}") from e
                
            # Otherwise, assume 400, 401, 403, etc are permanent configuration errors
            raise PermanentLLMError(f"Gemini permanent API error {status_code}: {str(e)}") from e
            
        except TransientLLMError:
            raise
            
        except PermanentLLMError:
            raise
            
        except Exception as e:
            error_str = str(e).lower()
            if "timeout" in error_str or "network" in error_str or "connection" in error_str:
                raise TransientLLMError(f"Gemini network or timeout error: {str(e)}") from e
            raise PermanentLLMError(f"Gemini unknown generation error: {str(e)}") from e
