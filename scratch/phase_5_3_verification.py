import asyncio
import httpx
import json
from uuid import uuid4
import os
import sys

# Add server to path so we can import models and DB directly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../server')))

from app.core.db import SessionLocal
from app.models.user import User
from app.models.repository import Repository, RepositoryVersion, UserRepository
from app.core.config import settings

BASE_URL = "http://localhost:8000"

async def setup_test_data():
    db = SessionLocal()
    try:
        # Create test user
        email = f"test_{uuid4()}@example.com"
        user = User(
            email=email,
            full_name="Test User"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create test repository
        repo = Repository(
            github_repo_id=str(uuid4()),
            owner="test_owner",
            name="test-repo",
            clone_url="https://github.com/test/repo",
            is_private=False
        )
        db.add(repo)
        db.commit()
        db.refresh(repo)
        
        # Grant user access
        user_repo = UserRepository(user_id=user.id, repository_id=repo.id)
        db.add(user_repo)
        db.commit()

        # Create test repository version (SUCCESS)
        version = RepositoryVersion(
            repository_id=repo.id,
            commit_sha="1234567890abcdef",
            branch="main",
            index_status="SUCCESS"
        )
        db.add(version)
        db.commit()
        db.refresh(version)

        # Insert session directly into redis
        session_id = str(uuid4())
        
        return user.id, repo.id, version.id, session_id
    finally:
        db.close()

async def run_verification():
    print("Setting up test data...")
    user_id, repo_id, version_id, session_id = await setup_test_data()
    
    import redis.asyncio as redis
    r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
    await r.set(f"session:{session_id}", str(user_id), ex=3600)
    
    cookies = {settings.SESSION_COOKIE_NAME: session_id}
    
    async with httpx.AsyncClient(cookies=cookies, timeout=60.0) as client:
        # 4. Test Authentication
        print("Testing valid session...")
        res = await client.get(f"{BASE_URL}/api/v1/auth/me")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        print("Testing invalid session...")
        res_invalid = await client.get(f"{BASE_URL}/api/v1/auth/me", cookies={settings.SESSION_COOKIE_NAME: "invalid"})
        assert res_invalid.status_code == 401, f"Expected 401, got {res_invalid.status_code}"
        
        # 5. Test Conversation Setup
        print("Creating conversation...")
        res = await client.post(
            f"{BASE_URL}/api/v1/repositories/{repo_id}/conversations",
            json={"title": "Test Chat"}
        )
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        conv_data = res.json()
        conv_id = conv_data["id"]
        
        # 6. Test First Streaming Message
        print("Testing stream message...")
        async with client.stream(
            "POST",
            f"{BASE_URL}/api/v1/conversations/{conv_id}/messages/stream",

            json={"content": "What is this repository about?"}
        ) as response:
            assert response.status_code == 200
            assert "text/event-stream" in response.headers["content-type"]
            
            events = []
            full_text = ""
            async for line in response.aiter_lines():
                if line.startswith("event: "):
                    event_type = line.split("event: ")[1].strip()
                    # read next line for data
                elif line.startswith("data: "):
                    data_str = line.split("data: ")[1].strip()
                    try:
                        data = json.loads(data_str)
                    except json.JSONDecodeError:
                        data = {}
                    events.append((event_type, data))
                    if event_type == "token":
                        full_text += data.get("text", "")

        event_types = [e[0] for e in events]
        print(f"Captured events: {event_types}")
        
        assert "message_start" in event_types, "Missing message_start"
        assert "token" in event_types, "Missing token"
        assert "message_complete" in event_types, "Missing message_complete"
        assert event_types.index("message_start") < event_types.index("token")
        assert event_types.index("token") < event_types.index("message_complete")
        
        print(f"Full answer assembled: {full_text[:50]}...")
        
        # 9. Validate Final Persistence
        print("Validating persistence...")
        res = await client.get(f"{BASE_URL}/api/v1/conversations/{conv_id}/messages")
        messages = res.json()["items"]
        assert len(messages) == 2, "Expected 2 messages (user, assistant)"
        assert messages[0]["role"] == "user"
        assert messages[0]["content"] == "What is this repository about?"
        assert messages[1]["role"] == "assistant"
        assert messages[1]["content"] == full_text
        
        # 11. Test Multi-Turn Conversation
        print("Testing multi-turn...")
        async with client.stream(
            "POST",
            f"{BASE_URL}/api/v1/conversations/{conv_id}/messages/stream",

            json={"content": "Can you explain that more?"}
        ) as response:
            async for line in response.aiter_lines():
                pass # Just consume
                
        res = await client.get(f"{BASE_URL}/api/v1/conversations/{conv_id}/messages")
        messages = res.json()["items"]
        assert len(messages) == 4, f"Expected 4 messages, got {len(messages)}"
        assert messages[2]["content"] == "Can you explain that more?"
        
        # 16. Test Redis Lock
        print("Testing concurrency lock...")
        # Fire two requests concurrently
        async def make_stream_req():
            try:
                async with client.stream(
                    "POST",
                    f"{BASE_URL}/api/v1/conversations/{conv_id}/messages/stream",
        
                    json={"content": "Concurrency test"},
                    timeout=60.0
                ) as response:
                    events = []
                    async for line in response.aiter_lines():
                        if line.startswith("event: "):
                            events.append(line.split("event: ")[1].strip())
                    return response.status_code, events
            except Exception as e:
                import traceback
                traceback.print_exc()
                return 500, f"{type(e).__name__}: {str(e)}"
                
        results = await asyncio.gather(make_stream_req(), make_stream_req())
        
        print(f"DEBUG results: {results}")
        
        # We expect one to succeed and one to return an error event (since it's a 200 OK stream that emits an error event)
        # Wait, the stream endpoint always returns 200, and yields an `error` event for lock conflicts!
        success_count = 0
        error_count = 0
        for status, evts in results:
            if status == 200:
                if "error" in evts:
                    error_count += 1
                elif "message_start" in evts:
                    success_count += 1
                    
        print(f"Concurrency results: {success_count} success, {error_count} error streams")
        assert success_count == 1, "Exactly one request should succeed"
        assert error_count == 1, "Exactly one request should fail with error event"
        
        # 21. Test Synchronous backward compatibility
        print("Testing synchronous compatibility...")
        res = await client.post(
            f"{BASE_URL}/api/v1/conversations/{conv_id}/messages",
            
            json={"content": "Hello synchronous!"}
        )
        assert res.status_code == 201, f"Expected 201 for synchronous endpoint, got {res.status_code}"
        assert "answer" in res.json(), "Missing 'answer' in synchronous response"
        
        print("ALL VERIFICATION PASSED!")

if __name__ == "__main__":
    asyncio.run(run_verification())
