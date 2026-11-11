import threading
import pytest
from unittest.mock import MagicMock
from app.core.config import settings
from app.main import lifespan, app


@pytest.mark.asyncio
async def test_lifespan_skips_worker_when_disabled(mocker):
    mocker.patch.object(settings, "ENABLE_EMBEDDED_WORKER", False)
    mock_thread = mocker.patch("app.main.threading.Thread")

    async with lifespan(app):
        pass

    mock_thread.assert_not_called()


@pytest.mark.asyncio
async def test_lifespan_starts_and_stops_worker_supervisor(mocker):
    mocker.patch.object(settings, "ENABLE_EMBEDDED_WORKER", True)
    mocker.patch.object(settings, "ENVIRONMENT", "production")

    fake_thread = MagicMock()
    fake_thread.is_alive.return_value = True
    mock_thread_cls = mocker.patch("app.main.threading.Thread", return_value=fake_thread)

    async with lifespan(app):
        mock_thread_cls.assert_called_once()
        fake_thread.start.assert_called_once()

    fake_thread.join.assert_called_once()

