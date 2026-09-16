import ast
from typing import List, Optional
from uuid import UUID

from app.models.knowledge import File, Symbol
from app.services.chunking.models import ASTNodeSpan, ChunkData
from app.services.chunking.algorithm import recursive_split, greedy_pack
from app.services.chunking.ast_parser import get_line_byte_offsets, convert_python_ast, convert_treesitter_ast
from app.services.chunking.line_chunker import LineChunker

class ASTChunker:
    def __init__(self, max_chars: int):
        self.max_chars = max_chars
        self.line_fallback = LineChunker(max_chars)
        
    def chunk(self, file_id: UUID, file_path: str, language: str, source_bytes: bytes, symbols: List[Symbol]) -> List[ChunkData]:
        source_text = source_bytes.decode('utf-8', 'replace')
        
        # 1. Parse into ASTNodeSpan
        root_span = self._parse_to_span(language, source_text, source_bytes)
        
        # Fallback if parser fails or is unsupported
        if not root_span:
            return self.line_fallback.chunk(file_id, file_path, language, source_bytes)
            
        # 2. Recursive Split
        structural_units = recursive_split(root_span, self.max_chars, source_bytes)
        
        # 3. Greedy Pack
        packed_ranges = greedy_pack(structural_units, self.max_chars, source_bytes)
        
        # 4. Map to ChunkData and assign symbols
        chunks = []
        for i, (start_byte, end_byte, start_line, end_line) in enumerate(packed_ranges):
            content = source_bytes[start_byte:end_byte].decode('utf-8', 'replace')
            sym_id, parent_sym_id = self._find_best_symbol(start_line, end_line, symbols)
            
            chunks.append(ChunkData(
                file_id=file_id,
                symbol_id=sym_id,
                parent_symbol_id=parent_sym_id,
                file_path=file_path,
                language=language,
                content=content,
                start_line=start_line,
                end_line=end_line,
                chunk_index=i
            ))
            
        return chunks

    def _parse_to_span(self, language: str, source_text: str, source_bytes: bytes) -> Optional[ASTNodeSpan]:
        if language == "python":
            try:
                tree = ast.parse(source_bytes)
                line_offsets = get_line_byte_offsets(source_text)
                
                # The root ast.Module doesn't always have valid line/col info.
                # Wrap it manually.
                children = []
                for child in ast.iter_child_nodes(tree):
                    child_span = convert_python_ast(child, source_text, source_bytes, line_offsets)
                    if child_span:
                        children.append(child_span)
                        
                children.sort(key=lambda c: c.start_byte)
                if not children:
                    return None
                    
                start_byte = 0
                end_byte = len(source_bytes)
                start_line = 1
                end_line = len(source_text.splitlines()) or 1
                
                return ASTNodeSpan(
                    start_byte=start_byte,
                    end_byte=end_byte,
                    start_line=start_line,
                    end_line=end_line,
                    children=children
                )
            except SyntaxError:
                return None
        
        if language in ("javascript", "jsx", "typescript", "tsx"):
            try:
                from app.services.symbol_extractor.javascript_extractor import JavaScriptExtractor
                extractor = JavaScriptExtractor(language)
                if not extractor.parser:
                    return None
                tree = extractor.parser.parse(source_bytes)
                if tree.root_node.has_error:
                    # Depending on severity, we might still proceed, but let's be safe
                    # Actually tree-sitter builds an AST even with errors. We can use it.
                    pass
                return convert_treesitter_ast(tree.root_node)
            except ImportError:
                return None
                
        return None

    def _find_best_symbol(self, start_line: int, end_line: int, symbols: List[Symbol]) -> Tuple[Optional[UUID], Optional[UUID]]:
        """
        Find the tightest enclosing symbol, or the symbol with the largest overlap.
        Returns (symbol_id, parent_symbol_id)
        """
        best_symbol = None
        best_parent = None
        
        # Filter symbols that enclose or overlap the chunk
        # A symbol encloses a chunk if symbol.start_line <= start_line and symbol.end_line >= end_line
        enclosing = [s for s in symbols if s.start_line <= start_line and s.end_line >= end_line]
        
        if enclosing:
            # Pick the smallest enclosing symbol (tightest)
            enclosing.sort(key=lambda s: s.end_line - s.start_line)
            best_symbol = enclosing[0]
            if len(enclosing) > 1:
                best_parent = enclosing[1].id
        else:
            # If no symbol fully encloses, check for overlap
            # Chunk: [start_line, end_line], Symbol: [s.start_line, s.end_line]
            overlaps = []
            for s in symbols:
                overlap_start = max(start_line, s.start_line)
                overlap_end = min(end_line, s.end_line)
                if overlap_start <= overlap_end:
                    overlaps.append((s, overlap_end - overlap_start + 1))
            
            if overlaps:
                # Pick the symbol with the largest overlap
                overlaps.sort(key=lambda x: x[1], reverse=True)
                best_symbol = overlaps[0][0]
                
        if best_symbol:
            return best_symbol.id, best_parent
            
        return None, None
