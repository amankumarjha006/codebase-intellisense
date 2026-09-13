from app.models.user import GithubAccount
from app.core.encryption import decrypt_token, TokenEncryptionError

def get_decrypted_token(github_account: GithubAccount) -> str:
    """
    Retrieves and decrypts the GitHub OAuth access token for a given account.
    Returns the plaintext token.
    Raises TokenEncryptionError if the account has no token or if decryption fails.
    """
    if not github_account.access_token_encrypted:
        raise TokenEncryptionError("GitHub account does not have an encrypted access token.")
        
    return decrypt_token(github_account.access_token_encrypted)
