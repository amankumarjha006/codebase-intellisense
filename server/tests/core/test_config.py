import pytest
from pydantic import ValidationError
from app.core.config import Settings


def test_config_import_without_encryption_key(monkeypatch):
    monkeypatch.delenv("GITHUB_TOKEN_ENCRYPTION_KEY", raising=False)
    settings = Settings(_env_file=None, ENVIRONMENT="development")
    assert settings.GITHUB_TOKEN_ENCRYPTION_KEY is None


def test_dev_login_defaults_to_false():
    settings = Settings(_env_file=None, ENVIRONMENT="development")
    assert settings.ENABLE_DEV_LOGIN is False


def _valid_prod_kwargs() -> dict:
    return {
        "ENVIRONMENT": "production",
        "ENABLE_DEV_LOGIN": False,
        "GITHUB_CLIENT_ID": "gh-client-id-123",
        "GITHUB_CLIENT_SECRET": "gh-client-secret-xyz",
        "GITHUB_TOKEN_ENCRYPTION_KEY": "fernet-key-32-chars-long-base64=",
        "FRONTEND_URL": "https://app.example.com/dashboard",
        "GITHUB_CALLBACK_URL": "https://api.example.com/api/v1/auth/github/callback",
        "CORS_ORIGINS": ["https://app.example.com"],
        "SESSION_COOKIE_SECURE": True,
    }


def test_valid_production_config_succeeds():
    settings = Settings(_env_file=None, **_valid_prod_kwargs())
    assert settings.ENVIRONMENT == "production"
    assert settings.ENABLE_DEV_LOGIN is False
    assert settings.SESSION_COOKIE_SECURE is True


def test_production_config_with_session_cookie_secure_none_succeeds():
    kwargs = _valid_prod_kwargs()
    kwargs["SESSION_COOKIE_SECURE"] = None
    settings = Settings(_env_file=None, **kwargs)
    assert settings.SESSION_COOKIE_SECURE is None


def test_production_config_rejects_enable_dev_login_true():
    kwargs = _valid_prod_kwargs()
    kwargs["ENABLE_DEV_LOGIN"] = True
    with pytest.raises(ValidationError, match="ENABLE_DEV_LOGIN must be False"):
        Settings(_env_file=None, **kwargs)


def test_production_config_rejects_missing_github_client_id():
    kwargs = _valid_prod_kwargs()
    kwargs["GITHUB_CLIENT_ID"] = ""
    with pytest.raises(ValidationError, match="GITHUB_CLIENT_ID must be set"):
        Settings(_env_file=None, **kwargs)

    kwargs["GITHUB_CLIENT_ID"] = None
    with pytest.raises(ValidationError, match="GITHUB_CLIENT_ID must be set"):
        Settings(_env_file=None, **kwargs)


def test_production_config_rejects_missing_github_client_secret():
    kwargs = _valid_prod_kwargs()
    kwargs["GITHUB_CLIENT_SECRET"] = ""
    with pytest.raises(ValidationError, match="GITHUB_CLIENT_SECRET must be set"):
        Settings(_env_file=None, **kwargs)

    kwargs["GITHUB_CLIENT_SECRET"] = None
    with pytest.raises(ValidationError, match="GITHUB_CLIENT_SECRET must be set"):
        Settings(_env_file=None, **kwargs)


def test_production_config_rejects_missing_encryption_key():
    kwargs = _valid_prod_kwargs()
    kwargs["GITHUB_TOKEN_ENCRYPTION_KEY"] = ""
    with pytest.raises(ValidationError, match="GITHUB_TOKEN_ENCRYPTION_KEY must be set"):
        Settings(_env_file=None, **kwargs)

    kwargs["GITHUB_TOKEN_ENCRYPTION_KEY"] = None
    with pytest.raises(ValidationError, match="GITHUB_TOKEN_ENCRYPTION_KEY must be set"):
        Settings(_env_file=None, **kwargs)


def test_production_config_rejects_http_frontend_url():
    kwargs = _valid_prod_kwargs()
    kwargs["FRONTEND_URL"] = "http://app.example.com/dashboard"
    with pytest.raises(ValidationError, match="FRONTEND_URL must use https://"):
        Settings(_env_file=None, **kwargs)


def test_production_config_rejects_http_callback_url():
    kwargs = _valid_prod_kwargs()
    kwargs["GITHUB_CALLBACK_URL"] = "http://api.example.com/callback"
    with pytest.raises(ValidationError, match="GITHUB_CALLBACK_URL must use https://"):
        Settings(_env_file=None, **kwargs)


@pytest.mark.parametrize("bad_origin", [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://localhost",
    "http://localhost",
])
def test_production_config_rejects_localhost_in_cors(bad_origin):
    kwargs = _valid_prod_kwargs()
    kwargs["CORS_ORIGINS"] = ["https://app.example.com", bad_origin]
    with pytest.raises(ValidationError, match="CORS_ORIGINS must not contain localhost or 127.0.0.1"):
        Settings(_env_file=None, **kwargs)


def test_production_config_rejects_insecure_cookie():
    kwargs = _valid_prod_kwargs()
    kwargs["SESSION_COOKIE_SECURE"] = False
    with pytest.raises(ValidationError, match="SESSION_COOKIE_SECURE must be None or True"):
        Settings(_env_file=None, **kwargs)


def test_dev_environment_permits_local_defaults():
    settings = Settings(
        _env_file=None,
        ENVIRONMENT="development",
        ENABLE_DEV_LOGIN=True,
        FRONTEND_URL="http://localhost:3000/dashboard",
        GITHUB_CALLBACK_URL="http://localhost:8000/api/v1/auth/github/callback",
        CORS_ORIGINS=["http://localhost:3000"],
        SESSION_COOKIE_SECURE=False,
    )
    assert settings.ENVIRONMENT == "development"
    assert settings.ENABLE_DEV_LOGIN is True
    assert settings.SESSION_COOKIE_SECURE is False
