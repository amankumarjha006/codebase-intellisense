import pytest
from app.models.conversation import Message
from app.repositories.message import MessageRepository
from tests.integration.conftest import IntegrationDataFactory

pytestmark = [pytest.mark.integration]

def test_message_create_no_open_transaction(db_session, redis_client):
    """
    Test that MessageRepository.create() does not leave an open transaction.
    """
    factory = IntegrationDataFactory(db_session, redis_client)
    user = factory.create_user()
    repo = factory.create_repository(user.id)
    version = factory.create_successful_version(repo.id)
    conv = factory.create_conversation(user.id, repo.id, version.id)

    # We must start with no open transaction
    db_session.commit()
    assert not db_session.in_transaction()

    repo = MessageRepository(db_session)
    msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content="Test message"
    )

    returned_msg = repo.create(msg)

    # The returned message should have its ID populated
    assert returned_msg.id is not None

    # The session must NOT be in a transaction
    assert not db_session.in_transaction()
