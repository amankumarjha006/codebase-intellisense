import urllib.parse
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


@pytest.fixture(autouse=True)
def isolate_test_redis(monkeypatch):
    """
    Ensure all tests run against an isolated test Redis DB (DB 15),
    preventing any test from polluting the development Redis DB (DB 0).
    """
    old_redis = settings.REDIS_URL
    parsed = urllib.parse.urlparse(old_redis)
    test_redis = urllib.parse.urlunparse(parsed._replace(path="/15"))
    monkeypatch.setattr(settings, "REDIS_URL", test_redis)
    yield

