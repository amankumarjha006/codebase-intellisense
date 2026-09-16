from app.models.knowledge import CodeChunk

class ChunkEmbeddingTextBuilder:
    """
    Builds a deterministic string representation of a CodeChunk for embedding generation.
    It combines available metadata with the raw source code.
    """
    
    @staticmethod
    def build(chunk: CodeChunk) -> str:
        """
        Builds the embedding text.
        Requires `chunk.file` and `chunk.symbol` to be eagerly loaded if they exist, 
        or assumes they are already loaded if accessed.
        To avoid unexpected lazy loading inside a loop, the caller should ensure
        the relationships are populated or we handle missing gracefully.
        """
        parts = []
        
        # File metadata
        if chunk.file:
            parts.append(f"File: {chunk.file.file_path}")
            parts.append(f"Language: {chunk.file.language}")
            
        # Symbol metadata
        if getattr(chunk, 'symbol', None):
            parts.append(f"Symbol: {chunk.symbol.name}")
            parts.append(f"Symbol Type: {chunk.symbol.symbol_type}")
            
        # Line range
        parts.append(f"Lines: {chunk.start_line}-{chunk.end_line}")
        
        # We join metadata with a newline
        metadata = "\n".join(parts)
        
        # Final output combines metadata and source code
        return f"{metadata}\n\n{chunk.content}"
