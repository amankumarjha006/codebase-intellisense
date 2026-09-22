"""
Domain models for the Answer Service layer.
"""
from dataclasses import dataclass
from typing import Tuple

from app.services.citation.models import Citation


@dataclass(frozen=True)
class AnswerRequest:
    """
    Request to assemble the final answer combining text and validated citations.
    """
    answer: str
    citations: Tuple[Citation, ...]


@dataclass(frozen=True)
class AnswerResponse:
    """
    The final assembled answer response.
    """
    answer: str
    citations: Tuple[Citation, ...]
