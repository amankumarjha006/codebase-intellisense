import asyncio
import logging
import random
from typing import TypeVar, Callable, Awaitable

from app.services.llm.exceptions import TransientLLMError

logger = logging.getLogger(__name__)

T = TypeVar("T")

class RetryExecutor:
    """
    Executes an asynchronous callable with bounded retries, exponential backoff, and jitter.
    Only retries explicitly classified transient exceptions (TransientLLMError).
    """
    def __init__(
        self,
        max_retries: int = 2,
        initial_backoff: float = 1.0,
        backoff_factor: float = 2.0,
        max_backoff: float = 10.0
    ):
        self.max_retries = max_retries
        self.initial_backoff = initial_backoff
        self.backoff_factor = backoff_factor
        self.max_backoff = max_backoff

    async def execute(self, func: Callable[[], Awaitable[T]]) -> T:
        """
        Executes the provided async function. Retries on TransientLLMError.
        """
        attempt = 0
        current_backoff = self.initial_backoff

        while True:
            try:
                return await func()
                
            except TransientLLMError as e:
                attempt += 1
                if attempt > self.max_retries:
                    logger.error(f"Max retries ({self.max_retries}) exceeded for TransientLLMError. Final error: {str(e)}")
                    raise

                # Add jitter (0 to 1 * current_backoff)
                sleep_time = current_backoff * (0.5 + random.random())
                # Cap the sleep time
                sleep_time = min(sleep_time, self.max_backoff)
                
                logger.warning(f"Transient failure detected (attempt {attempt}/{self.max_retries}). Retrying in {sleep_time:.2f}s... Error: {str(e)}")
                await asyncio.sleep(sleep_time)
                
                # Exponentially increase the base backoff for next time
                current_backoff = min(current_backoff * self.backoff_factor, self.max_backoff)
