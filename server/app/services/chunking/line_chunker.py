from typing import List
from uuid import UUID
from app.services.chunking.models import ChunkData
from app.services.chunking.algorithm import content_size

class LineChunker:
    """
    Fallback chunker for unsupported languages.
    Uses a greedy line-based strategy.
    """
    def __init__(self, max_chars: int):
        self.max_chars = max_chars

    def chunk(self, file_id: UUID, file_path: str, language: str, source_bytes: bytes) -> List[ChunkData]:
        source_text = source_bytes.decode('utf-8', 'replace')
        lines = source_text.splitlines(keepends=True)
        
        chunks = []
        current_chunk_lines = []
        current_start_line = 1
        
        chunk_index = 0
        
        for i, line in enumerate(lines):
            line_num = i + 1
            proposed_text = "".join(current_chunk_lines + [line])
            if current_chunk_lines and content_size(proposed_text) > self.max_chars:
                # Flush current
                chunks.append(ChunkData(
                    file_id=file_id,
                    symbol_id=None,
                    parent_symbol_id=None,
                    file_path=file_path,
                    language=language,
                    content="".join(current_chunk_lines),
                    start_line=current_start_line,
                    end_line=line_num - 1,
                    chunk_index=chunk_index
                ))
                chunk_index += 1
                current_chunk_lines = [line]
                current_start_line = line_num
            else:
                current_chunk_lines.append(line)
                
        if current_chunk_lines:
            chunks.append(ChunkData(
                file_id=file_id,
                symbol_id=None,
                parent_symbol_id=None,
                file_path=file_path,
                language=language,
                content="".join(current_chunk_lines),
                start_line=current_start_line,
                end_line=len(lines),
                chunk_index=chunk_index
            ))
            
        return chunks
