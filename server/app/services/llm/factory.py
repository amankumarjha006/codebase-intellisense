from app.core.config import Settings
from app.services.llm.provider import LLMProvider
from app.services.llm.gemini import GeminiLLMProvider
from app.services.llm.openrouter import OpenRouterLLMProvider
from app.services.llm.fallback import FallbackLLMProvider

def create_llm_provider(settings: Settings) -> LLMProvider:
    """
    Creates the configured LLM provider chain.
    """
    # Primary Gemini provider
    primary_gemini = GeminiLLMProvider(
        api_key=settings.GEMINI_API_KEY,
        model=settings.GEMINI_LLM_MODEL_PRIMARY
    )
    
    if not settings.LLM_FALLBACK_ENABLED:
        return primary_gemini
        
    providers = [primary_gemini]
    
    # Fallback 1 Gemini provider
    if settings.GEMINI_LLM_MODEL_FALLBACK_1:
        providers.append(GeminiLLMProvider(
            api_key=settings.GEMINI_API_KEY,
            model=settings.GEMINI_LLM_MODEL_FALLBACK_1
        ))
        
    # Fallback 2 Gemini provider
    if settings.GEMINI_LLM_MODEL_FALLBACK_2:
        providers.append(GeminiLLMProvider(
            api_key=settings.GEMINI_API_KEY,
            model=settings.GEMINI_LLM_MODEL_FALLBACK_2
        ))
        
    # OpenRouter final fallback
    if settings.OPENROUTER_FALLBACK_MODEL and settings.OPENROUTER_API_KEY:
        providers.append(OpenRouterLLMProvider(
            api_key=settings.OPENROUTER_API_KEY,
            model=settings.OPENROUTER_FALLBACK_MODEL
        ))
        
    return FallbackLLMProvider(providers=providers)
