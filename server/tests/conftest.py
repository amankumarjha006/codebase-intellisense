import pytest
from app.core.config import settings

@pytest.fixture
def valid_encryption_key():
    old_key = settings.GITHUB_TOKEN_ENCRYPTION_KEY
    # 32 bytes base64 encoded for Fernet
    test_key = b"abcdefghijklmnopqrstuvwxyz1234567890abcdefA=".decode("utf-8")
    settings.GITHUB_TOKEN_ENCRYPTION_KEY = test_key
    yield test_key
    settings.GITHUB_TOKEN_ENCRYPTION_KEY = old_key
