class ConversationError(Exception):
    """Base exception for conversation domain."""
    pass

class ConversationNotFoundError(ConversationError):
    """Raised when a conversation is not found or does not belong to the user."""
    pass

class ActiveVersionNotFoundError(ConversationError):
    """Raised when trying to create a conversation for a repository without an active version."""
    pass
