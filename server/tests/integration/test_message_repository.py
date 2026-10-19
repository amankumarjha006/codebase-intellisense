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


def test_conversation_list_and_message_citations(db_session, redis_client):
    """
    Test that ConversationRepository.list_for_user populates message_count & last_message_at,
    and MessageRepository.list_for_conversation eager-loads citations with real Postgres.
    """
    from app.models.conversation import Citation
    from app.repositories.conversation import ConversationRepository

    factory = IntegrationDataFactory(db_session, redis_client)
    user = factory.create_user()
    repo = factory.create_repository(user.id)
    version = factory.create_successful_version(repo.id)
    conv = factory.create_conversation(user.id, repo.id, version.id)

    msg_repo = MessageRepository(db_session)
    msg1 = Message(conversation_id=conv.id, role="user", content="Question 1")
    msg1 = msg_repo.create(msg1)

    msg2 = Message(conversation_id=conv.id, role="assistant", content="Answer 1")
    msg2.citations = [
        Citation(file_path="src/app.py", start_line=10, end_line=20)
    ]
    msg2 = msg_repo.create(msg2)

    # 1. Test ConversationRepository.list_for_user
    conv_repo = ConversationRepository(db_session)
    conversations, total = conv_repo.list_for_user(user.id, repo.id)
    assert total == 1
    assert len(conversations) == 1
    assert conversations[0].message_count == 2
    assert conversations[0].last_message_at is not None

    # 2. Test MessageRepository.list_for_conversation eager loading
    msgs, msg_total = msg_repo.list_for_conversation(conv.id)
    assert msg_total == 2
    assert len(msgs) == 2
    assert msgs[0].role == "user"
    assert msgs[0].citations == []
    assert msgs[1].role == "assistant"
    assert len(msgs[1].citations) == 1
    assert msgs[1].citations[0].file_path == "src/app.py"

