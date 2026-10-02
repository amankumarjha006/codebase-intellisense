import pytest
import asyncio
from unittest.mock import AsyncMock

from app.core.retry import RetryExecutor
from app.services.llm.exceptions import TransientLLMError, PermanentLLMError

@pytest.mark.asyncio
async def test_retry_success_on_first_try():
    executor = RetryExecutor(max_retries=2, initial_backoff=0.01)
    mock_func = AsyncMock(return_value="success")
    
    result = await executor.execute(mock_func)
    
    assert result == "success"
    assert mock_func.call_count == 1

@pytest.mark.asyncio
async def test_retry_transient_failure_then_success():
    executor = RetryExecutor(max_retries=2, initial_backoff=0.01)
    mock_func = AsyncMock(side_effect=[TransientLLMError("Temporary failure"), "success"])
    
    result = await executor.execute(mock_func)
    
    assert result == "success"
    assert mock_func.call_count == 2

@pytest.mark.asyncio
async def test_retry_transient_failure_max_retries_exceeded():
    executor = RetryExecutor(max_retries=2, initial_backoff=0.01)
    mock_func = AsyncMock(side_effect=TransientLLMError("Temporary failure"))
    
    with pytest.raises(TransientLLMError):
        await executor.execute(mock_func)
        
    assert mock_func.call_count == 3  # Initial try + 2 retries

@pytest.mark.asyncio
async def test_no_retry_on_permanent_error():
    executor = RetryExecutor(max_retries=2, initial_backoff=0.01)
    mock_func = AsyncMock(side_effect=PermanentLLMError("Permanent failure"))
    
    with pytest.raises(PermanentLLMError):
        await executor.execute(mock_func)
        
    assert mock_func.call_count == 1

@pytest.mark.asyncio
async def test_no_retry_on_generic_error():
    executor = RetryExecutor(max_retries=2, initial_backoff=0.01)
    mock_func = AsyncMock(side_effect=ValueError("Invalid arguments"))
    
    with pytest.raises(ValueError):
        await executor.execute(mock_func)
        
    assert mock_func.call_count == 1
