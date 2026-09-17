import httpx

from app.services.llm.exceptions import (
    LLMError,
    TransientLLMError,
    PermanentLLMError,
    ProviderUnavailableError,
)
from app.services.llm.provider import LLMProvider

class OpenRouterLLMProvider(LLMProvider):
    def __init__(self, api_key: str | None, model: str = "openrouter/free"):
        self.model = model
        if not api_key:
            raise PermanentLLMError("OPENROUTER_API_KEY must be provided")
        self.api_key = api_key
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"

    async def generate(self, prompt: str, system_instruction: str | None = None) -> str:
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "http://localhost:8000", # Required by OpenRouter, could be configurable
            "X-Title": "Codebase Intelligence", # Optional but recommended
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.model,
            "messages": messages
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.base_url,
                    json=payload,
                    headers=headers,
                    timeout=httpx.Timeout(60.0)
                )

            # Map status codes
            if response.status_code in (429, 500, 502, 503, 504):
                raise TransientLLMError(f"OpenRouter transient error {response.status_code}")
                
            if response.status_code == 404:
                raise ProviderUnavailableError(f"OpenRouter model {self.model} unavailable (404)")

            if not response.is_success:
                raise PermanentLLMError(f"OpenRouter permanent error {response.status_code}: {response.text}")

            data = response.json()
            if not data or "choices" not in data or not data["choices"]:
                raise PermanentLLMError("Received empty or malformed response from OpenRouter")

            text = data["choices"][0].get("message", {}).get("content")
            if not text:
                raise PermanentLLMError("OpenRouter response did not contain content")
                
            return text

        except TransientLLMError:
            raise
        except PermanentLLMError:
            raise
        except httpx.TimeoutException as e:
            raise TransientLLMError(f"OpenRouter timeout: {str(e)}") from e
        except httpx.NetworkError as e:
            raise TransientLLMError(f"OpenRouter network error: {str(e)}") from e
        except Exception as e:
            raise PermanentLLMError(f"OpenRouter unknown error: {str(e)}") from e
