import pytest

pytestmark = pytest.mark.usefixtures("valid_encryption_key")

from app.core.encryption import encrypt_token, decrypt_token, _get_fernet, TokenEncryptionError
from app.core.config import settings

def test_encrypt_decrypt():
    plaintext = "ghu_1234567890abcdef"
    ciphertext = encrypt_token(plaintext)
    
    assert ciphertext != plaintext
    assert isinstance(ciphertext, str)
    
    decrypted = decrypt_token(ciphertext)
    assert decrypted == plaintext

def test_different_plaintexts_produce_different_ciphertexts():
    t1 = encrypt_token("a")
    t2 = encrypt_token("b")
    assert t1 != t2

def test_invalid_ciphertext_fails():
    with pytest.raises(TokenEncryptionError, match="Invalid ciphertext or encryption key mismatch."):
        decrypt_token("not-a-valid-token")

def test_missing_encryption_key_fails(monkeypatch):
    monkeypatch.setattr(settings, "GITHUB_TOKEN_ENCRYPTION_KEY", "")
    with pytest.raises(TokenEncryptionError, match="Missing encryption configuration."):
        _get_fernet()

def test_invalid_encryption_key_fails(monkeypatch):
    monkeypatch.setattr(settings, "GITHUB_TOKEN_ENCRYPTION_KEY", "invalid_key")
    with pytest.raises(TokenEncryptionError, match="Invalid encryption configuration."):
        _get_fernet()
