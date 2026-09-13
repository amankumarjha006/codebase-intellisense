import logging
from cryptography.fernet import Fernet, InvalidToken
from app.core.config import settings

logger = logging.getLogger(__name__)

class TokenEncryptionError(Exception):
    """Raised when token encryption or decryption fails safely."""
    pass

def _get_fernet() -> Fernet:
    key = settings.GITHUB_TOKEN_ENCRYPTION_KEY
    if not key:
        raise TokenEncryptionError("Missing encryption configuration.")
    try:
        return Fernet(key.encode("utf-8") if isinstance(key, str) else key)
    except Exception as e:
        logger.error("Encryption initialization failed due to invalid key format.")
        raise TokenEncryptionError("Invalid encryption configuration.") from e

def encrypt_token(plaintext: str) -> str:
    """Encrypts a plaintext string securely."""
    if not plaintext:
        raise TokenEncryptionError("Cannot encrypt an empty token.")
    fernet = _get_fernet()
    return fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")

def decrypt_token(ciphertext: str) -> str:
    """Decrypts a previously encrypted string back to plaintext."""
    if not ciphertext:
        raise TokenEncryptionError("Cannot decrypt an empty ciphertext.")
    fernet = _get_fernet()
    try:
        return fernet.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken as e:
        logger.error("Failed to decrypt token.")
        raise TokenEncryptionError("Invalid ciphertext or encryption key mismatch.") from e
