import pytest
from unittest.mock import AsyncMock, MagicMock
import httpx
from google.genai.errors import APIError

from app.services.llm.exceptions import LLMError, TransientLLMError, PermanentLLMError, ProviderUnavailableError
from app.services.llm.provider import LLMProvider
from app.services.llm.gemini import GeminiLLMProvider
from app.services.llm.openrouter import OpenRouterLLMProvider
from app.services.llm.fallback import FallbackLLMProvider
from app.services.llm.factory import create_llm_provider
from app.core.config import Settings

@pytest.fixture
def mock_genai_client(monkeypatch):
    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock()
    
    def fake_client(*args, **kwargs):
        return mock_client
        
    monkeypatch.setattr("app.services.llm.gemini.genai.Client", fake_client)
    return mock_client

@pytest.fixture
def mock_httpx(monkeypatch):
    mock_post = AsyncMock()
    
    class MockAsyncClient:
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass
        def __init__(self, *args, **kwargs):
            self.post = mock_post
            
    monkeypatch.setattr("app.services.llm.openrouter.httpx.AsyncClient", MockAsyncClient)
    return mock_post

def create_api_error(status_code: int, message: str) -> APIError:
    # Google GenAI APIError takes message and response
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    err = APIError(message, response=mock_resp)
    err.code = status_code
    return err

def test_01_gemini_primary_success(mock_genai_client):
    provider = GeminiLLMProvider(api_key="fake-key", model="gemini-3.8-flash")
    mock_response = MagicMock()
    mock_response.text = "Hello world"
    mock_genai_client.aio.models.generate_content.return_value = mock_response
    
    import asyncio
    result = asyncio.run(provider.generate("Say hello"))
    assert result == "Hello world"
    mock_genai_client.aio.models.generate_content.assert_called_once()

def test_02_gemini_3_8_transient_429(mock_genai_client):
    provider1 = GeminiLLMProvider(api_key="fake-key", model="gemini-3.8-flash")
    provider2 = GeminiLLMProvider(api_key="fake-key", model="gemini-3.7-flash")
    fallback = FallbackLLMProvider([provider1, provider2])
    
    # Provider 1 fails with 429
    mock_genai_client.aio.models.generate_content.side_effect = [
        create_api_error(429, "Too Many Requests"),
        MagicMock(text="Success from 3.7")
    ]
    
    import asyncio
    result = asyncio.run(fallback.generate("Hi"))
    assert result == "Success from 3.7"
    assert mock_genai_client.aio.models.generate_content.call_count == 2

def test_03_gemini_3_8_transient_503(mock_genai_client):
    provider1 = GeminiLLMProvider(api_key="fake-key", model="gemini-3.8-flash")
    provider2 = GeminiLLMProvider(api_key="fake-key", model="gemini-3.7-flash")
    fallback = FallbackLLMProvider([provider1, provider2])
    
    mock_genai_client.aio.models.generate_content.side_effect = [
        create_api_error(503, "Service Unavailable"),
        MagicMock(text="Success from 3.7")
    ]
    
    import asyncio
    result = asyncio.run(fallback.generate("Hi"))
    assert result == "Success from 3.7"

def test_04_gemini_3_8_timeout(mock_genai_client):
    provider1 = GeminiLLMProvider(api_key="fake-key", model="gemini-3.8-flash")
    provider2 = GeminiLLMProvider(api_key="fake-key", model="gemini-3.7-flash")
    fallback = FallbackLLMProvider([provider1, provider2])
    
    # Non-APIError exception simulating timeout
    mock_genai_client.aio.models.generate_content.side_effect = [
        Exception("connection timeout"),
        MagicMock(text="Success from 3.7")
    ]
    
    import asyncio
    result = asyncio.run(fallback.generate("Hi"))
    assert result == "Success from 3.7"

def test_05_gemini_3_8_model_unavailable(mock_genai_client):
    provider1 = GeminiLLMProvider(api_key="fake-key", model="gemini-3.8-flash")
    provider2 = GeminiLLMProvider(api_key="fake-key", model="gemini-3.7-flash")
    fallback = FallbackLLMProvider([provider1, provider2])
    
    # 404 Model not found
    mock_genai_client.aio.models.generate_content.side_effect = [
        create_api_error(404, "models/gemini-3.8-flash not found"),
        MagicMock(text="Success from 3.7")
    ]
    
    import asyncio
    result = asyncio.run(fallback.generate("Hi"))
    assert result == "Success from 3.7"

def test_06_3_8_and_3_7_unavailable(mock_genai_client):
    provider1 = GeminiLLMProvider(api_key="fake-key", model="gemini-3.8-flash")
    provider2 = GeminiLLMProvider(api_key="fake-key", model="gemini-3.7-flash")
    provider3 = GeminiLLMProvider(api_key="fake-key", model="gemini-3.6-flash")
    fallback = FallbackLLMProvider([provider1, provider2, provider3])
    
    mock_genai_client.aio.models.generate_content.side_effect = [
        create_api_error(404, "not found"),
        create_api_error(404, "not found"),
        MagicMock(text="Success from 3.6")
    ]
    
    import asyncio
    result = asyncio.run(fallback.generate("Hi"))
    assert result == "Success from 3.6"
    assert mock_genai_client.aio.models.generate_content.call_count == 3

def test_07_all_gemini_unavailable_openrouter_called(mock_genai_client, mock_httpx):
    provider1 = GeminiLLMProvider(api_key="fake-key", model="gemini-3.8-flash")
    provider2 = GeminiLLMProvider(api_key="fake-key", model="gemini-3.7-flash")
    provider3 = GeminiLLMProvider(api_key="fake-key", model="gemini-3.6-flash")
    openrouter = OpenRouterLLMProvider(api_key="fake-or-key")
    fallback = FallbackLLMProvider([provider1, provider2, provider3, openrouter])
    
    mock_genai_client.aio.models.generate_content.side_effect = [
        create_api_error(404, "not found"),
        create_api_error(404, "not found"),
        create_api_error(404, "not found"),
    ]
    
    mock_or_resp = MagicMock()
    mock_or_resp.status_code = 200
    mock_or_resp.is_success = True
    mock_or_resp.json.return_value = {"choices": [{"message": {"content": "OpenRouter Success"}}]}
    mock_httpx.return_value = mock_or_resp
    
    import asyncio
    result = asyncio.run(fallback.generate("Hi"))
    assert result == "OpenRouter Success"
    assert mock_genai_client.aio.models.generate_content.call_count == 3
    assert mock_httpx.call_count == 1

def test_08_gemini_auth_failure_no_fallback(mock_genai_client):
    provider1 = GeminiLLMProvider(api_key="fake-key", model="gemini-3.8-flash")
    provider2 = GeminiLLMProvider(api_key="fake-key", model="gemini-3.7-flash")
    fallback = FallbackLLMProvider([provider1, provider2])
    
    mock_genai_client.aio.models.generate_content.side_effect = create_api_error(401, "Invalid API Key")
    
    import asyncio
    with pytest.raises(PermanentLLMError) as exc_info:
        asyncio.run(fallback.generate("Hi"))
        
    assert "401" in str(exc_info.value)
    # Only called once because 401 is permanent
    assert mock_genai_client.aio.models.generate_content.call_count == 1

def test_09_gemini_malformed_request_no_fallback(mock_genai_client):
    provider1 = GeminiLLMProvider(api_key="fake-key", model="gemini-3.8-flash")
    provider2 = GeminiLLMProvider(api_key="fake-key", model="gemini-3.7-flash")
    fallback = FallbackLLMProvider([provider1, provider2])
    
    mock_genai_client.aio.models.generate_content.side_effect = create_api_error(400, "Malformed request")
    
    import asyncio
    with pytest.raises(PermanentLLMError):
        asyncio.run(fallback.generate("Hi"))
        
    assert mock_genai_client.aio.models.generate_content.call_count == 1

def test_10_openrouter_failure_propagates(mock_genai_client, mock_httpx):
    openrouter = OpenRouterLLMProvider(api_key="fake-or-key")
    fallback = FallbackLLMProvider([openrouter])
    
    mock_or_resp = MagicMock()
    mock_or_resp.status_code = 503
    mock_httpx.return_value = mock_or_resp
    
    import asyncio
    with pytest.raises(TransientLLMError) as exc_info:
        asyncio.run(fallback.generate("Hi"))
    assert "503" in str(exc_info.value)

def test_11_fallback_disabled(mock_genai_client):
    settings = Settings(LLM_FALLBACK_ENABLED=False, GEMINI_API_KEY="key", GEMINI_LLM_MODEL_PRIMARY="m1")
    provider = create_llm_provider(settings)
    
    # Factory returns just GeminiLLMProvider
    assert isinstance(provider, GeminiLLMProvider)
    
    mock_genai_client.aio.models.generate_content.side_effect = create_api_error(503, "transient")
    
    import asyncio
    with pytest.raises(TransientLLMError):
        asyncio.run(provider.generate("Hi"))
        
    assert mock_genai_client.aio.models.generate_content.call_count == 1

def test_12_exact_provider_order():
    settings = Settings(
        LLM_FALLBACK_ENABLED=True,
        GEMINI_API_KEY="key",
        GEMINI_LLM_MODEL_PRIMARY="m1",
        GEMINI_LLM_MODEL_FALLBACK_1="m2",
        GEMINI_LLM_MODEL_FALLBACK_2="m3",
        OPENROUTER_API_KEY="orkey",
        OPENROUTER_FALLBACK_MODEL="or-model"
    )
    fallback = create_llm_provider(settings)
    assert isinstance(fallback, FallbackLLMProvider)
    assert len(fallback.providers) == 4
    assert fallback.providers[0].model == "m1"
    assert fallback.providers[1].model == "m2"
    assert fallback.providers[2].model == "m3"
    assert fallback.providers[3].model == "or-model"

def test_13_prompt_propagation(mock_genai_client):
    provider = GeminiLLMProvider(api_key="fake-key", model="gemini-3.8-flash")
    mock_response = MagicMock(text="ok")
    mock_genai_client.aio.models.generate_content.return_value = mock_response
    
    import asyncio
    asyncio.run(provider.generate("Test Prompt"))
    
    mock_genai_client.aio.models.generate_content.assert_called_with(
        model="gemini-3.8-flash",
        contents="Test Prompt",
        config=None
    )

def test_14_system_instruction_propagation(mock_genai_client):
    provider = GeminiLLMProvider(api_key="fake-key", model="gemini-3.8-flash")
    mock_response = MagicMock(text="ok")
    mock_genai_client.aio.models.generate_content.return_value = mock_response
    
    import asyncio
    asyncio.run(provider.generate("Test Prompt", system_instruction="SysInst"))
    
    _, kwargs = mock_genai_client.aio.models.generate_content.call_args
    assert kwargs["config"].system_instruction == "SysInst"

def test_15_openrouter_request_format(mock_httpx):
    provider = OpenRouterLLMProvider(api_key="fake-or-key", model="openrouter/free")
    mock_or_resp = MagicMock(status_code=200, is_success=True)
    mock_or_resp.json.return_value = {"choices": [{"message": {"content": "ok"}}]}
    mock_httpx.return_value = mock_or_resp
    
    import asyncio
    asyncio.run(provider.generate("Prompt", system_instruction="SysInst"))
    
    mock_httpx.assert_called_once()
    _, kwargs = mock_httpx.call_args
    assert kwargs["headers"]["Authorization"] == "Bearer fake-or-key"
    assert kwargs["json"]["model"] == "openrouter/free"
    assert kwargs["json"]["messages"][0]["content"] == "SysInst"
    assert kwargs["json"]["messages"][1]["content"] == "Prompt"

def test_16_gemini_response_extraction(mock_genai_client):
    provider = GeminiLLMProvider(api_key="key", model="m1")
    mock_response = MagicMock()
    mock_response.text = "Extracted response"
    mock_genai_client.aio.models.generate_content.return_value = mock_response
    
    import asyncio
    res = asyncio.run(provider.generate("Hi"))
    assert res == "Extracted response"

def test_17_empty_gemini_response(mock_genai_client):
    provider = GeminiLLMProvider(api_key="key", model="m1")
    mock_response = MagicMock()
    mock_response.text = "" # empty
    mock_genai_client.aio.models.generate_content.return_value = mock_response
    
    import asyncio
    with pytest.raises(PermanentLLMError):
        asyncio.run(provider.generate("Hi"))

def test_18_empty_openrouter_response(mock_httpx):
    provider = OpenRouterLLMProvider(api_key="key")
    mock_or_resp = MagicMock(status_code=200, is_success=True)
    mock_or_resp.json.return_value = {"choices": []} # malformed
    mock_httpx.return_value = mock_or_resp
    
    import asyncio
    with pytest.raises(PermanentLLMError):
        asyncio.run(provider.generate("Hi"))

def test_19_api_keys_not_in_logs(caplog, mock_genai_client):
    provider1 = GeminiLLMProvider(api_key="SUPER_SECRET_KEY_123", model="m1")
    provider2 = GeminiLLMProvider(api_key="OTHER_SECRET_KEY", model="m2")
    fallback = FallbackLLMProvider([provider1, provider2])
    
    mock_genai_client.aio.models.generate_content.side_effect = [
        create_api_error(503, "unavailable"),
        MagicMock(text="ok")
    ]
    
    import asyncio
    asyncio.run(fallback.generate("Hi"))
    
    assert "SUPER_SECRET_KEY" not in caplog.text
    assert "OTHER_SECRET_KEY" not in caplog.text
    assert "m1" in caplog.text
    assert "GeminiLLMProvider" in caplog.text

def test_20_api_keys_not_in_exceptions(mock_genai_client):
    provider1 = GeminiLLMProvider(api_key="SUPER_SECRET_KEY_123", model="m1")
    
    mock_genai_client.aio.models.generate_content.side_effect = create_api_error(401, "unauthorized")
    
    import asyncio
    with pytest.raises(PermanentLLMError) as exc:
        asyncio.run(provider1.generate("Hi"))
        
    assert "SUPER_SECRET_KEY" not in str(exc.value)

def test_21_factory_creates_correct_chain():
    settings = Settings(
        LLM_FALLBACK_ENABLED=True,
        GEMINI_API_KEY="key",
        GEMINI_LLM_MODEL_PRIMARY="gemini-3.8-flash",
        GEMINI_LLM_MODEL_FALLBACK_1="gemini-3.7-flash",
        GEMINI_LLM_MODEL_FALLBACK_2="gemini-3.6-flash",
        OPENROUTER_API_KEY="orkey",
        OPENROUTER_FALLBACK_MODEL="openrouter/free"
    )
    provider = create_llm_provider(settings)
    assert isinstance(provider, FallbackLLMProvider)
    assert len(provider.providers) == 4

def test_22_each_gemini_receives_correct_model():
    settings = Settings(
        LLM_FALLBACK_ENABLED=True,
        GEMINI_API_KEY="key",
        GEMINI_LLM_MODEL_PRIMARY="3.8",
        GEMINI_LLM_MODEL_FALLBACK_1="3.7",
        GEMINI_LLM_MODEL_FALLBACK_2="3.6",
        OPENROUTER_API_KEY="key",
    )
    provider = create_llm_provider(settings)
    assert provider.providers[0].model == "3.8"
    assert provider.providers[1].model == "3.7"
    assert provider.providers[2].model == "3.6"

def test_23_permanent_error_at_3_7_stops_chain(mock_genai_client):
    provider1 = GeminiLLMProvider(api_key="key", model="3.8")
    provider2 = GeminiLLMProvider(api_key="key", model="3.7")
    provider3 = GeminiLLMProvider(api_key="key", model="3.6")
    fallback = FallbackLLMProvider([provider1, provider2, provider3])
    
    mock_genai_client.aio.models.generate_content.side_effect = [
        create_api_error(503, "transient"),
        create_api_error(401, "permanent"),
    ]
    
    import asyncio
    with pytest.raises(PermanentLLMError):
        asyncio.run(fallback.generate("Hi"))
        
    assert mock_genai_client.aio.models.generate_content.call_count == 2

def test_24_permanent_error_at_3_6_stops_chain(mock_genai_client, mock_httpx):
    provider1 = GeminiLLMProvider(api_key="key", model="3.8")
    provider2 = GeminiLLMProvider(api_key="key", model="3.7")
    provider3 = GeminiLLMProvider(api_key="key", model="3.6")
    openrouter = OpenRouterLLMProvider(api_key="key")
    fallback = FallbackLLMProvider([provider1, provider2, provider3, openrouter])
    
    mock_genai_client.aio.models.generate_content.side_effect = [
        create_api_error(503, "transient"),
        create_api_error(503, "transient"),
        create_api_error(400, "permanent"),
    ]
    
    import asyncio
    with pytest.raises(PermanentLLMError):
        asyncio.run(fallback.generate("Hi"))
        
    assert mock_genai_client.aio.models.generate_content.call_count == 3
    assert mock_httpx.call_count == 0
