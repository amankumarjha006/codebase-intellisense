import os
from pydantic_settings import BaseSettings

def test_config_import_without_encryption_key(monkeypatch):
    # Ensure the environment variable is not set
    monkeypatch.delenv("GITHUB_TOKEN_ENCRYPTION_KEY", raising=False)
    
    # We must reload the module or re-instantiate Settings to prove it doesn't fail.
    from app.core.config import Settings
    
    # This should not raise ValidationError
    # We pass _env_file=None to ignore the .env file in the repository
    settings = Settings(_env_file=None)
    
    # Also verify that the key defaults to None
    assert settings.GITHUB_TOKEN_ENCRYPTION_KEY is None
