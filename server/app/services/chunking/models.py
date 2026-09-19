from dataclasses import dataclass
from typing import Optional
from uuid import UUID

@dataclass(frozen=True)
class ChunkData:
    file_id: UUID
    symbol_id: Optional[UUID]
    file_path: str
    language: str
    content: str
    start_line: int
    end_line: int
    chunk_index: int

@dataclass(frozen=True)
class ASTNodeSpan:
    start_byte: int
    end_byte: int
    start_line: int
    end_line: int
    children: list['ASTNodeSpan']
