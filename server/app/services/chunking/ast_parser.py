import ast
from typing import List, Optional
from uuid import UUID
from app.models.knowledge import Symbol
from app.services.chunking.models import ASTNodeSpan, ChunkData
from app.services.chunking.algorithm import recursive_split, greedy_pack

def get_line_byte_offsets(source_text: str) -> List[int]:
    offsets = [0]
    # source_text is decoded, but we need byte offsets
    # however, we can map character offsets to byte offsets easily by encoding
    for line in source_text.splitlines(keepends=True):
        offsets.append(offsets[-1] + len(line.encode('utf-8')))
    return offsets

def convert_python_ast(node: ast.AST, source_text: str, source_bytes: bytes, line_offsets: List[int]) -> Optional[ASTNodeSpan]:
    if not hasattr(node, 'lineno') or not hasattr(node, 'end_lineno') or not hasattr(node, 'col_offset') or not hasattr(node, 'end_col_offset'):
        return None
        
    start_line = node.lineno
    end_line = node.end_lineno
    start_col = node.col_offset
    end_col = node.end_col_offset
    
    if start_line is None or end_line is None or start_col is None or end_col is None:
        return None

    lines = source_text.splitlines(keepends=True)
    
    # Calculate start_byte
    if start_line - 1 < len(lines):
        line_str = lines[start_line - 1]
        char_prefix = line_str[:start_col]
        start_byte = line_offsets[start_line - 1] + len(char_prefix.encode('utf-8'))
    else:
        start_byte = line_offsets[-1]
        
    # Calculate end_byte
    if end_line - 1 < len(lines):
        line_str = lines[end_line - 1]
        char_prefix = line_str[:end_col]
        end_byte = line_offsets[end_line - 1] + len(char_prefix.encode('utf-8'))
    else:
        end_byte = line_offsets[-1]
    
    children = []
    for child in ast.iter_child_nodes(node):
        child_span = convert_python_ast(child, source_text, source_bytes, line_offsets)
        if child_span:
            children.append(child_span)
            
    # Sort children by start_byte to ensure order
    children.sort(key=lambda c: c.start_byte)
            
    return ASTNodeSpan(
        start_byte=start_byte,
        end_byte=end_byte,
        start_line=start_line,
        end_line=end_line,
        children=children
    )

def convert_treesitter_ast(node) -> ASTNodeSpan:
    children = []
    for child in node.children:
        children.append(convert_treesitter_ast(child))
        
    return ASTNodeSpan(
        start_byte=node.start_byte,
        end_byte=node.end_byte,
        start_line=node.start_point[0] + 1,
        end_line=node.end_point[0] + 1,
        children=children
    )
