from typing import List, Tuple
from app.services.chunking.models import ASTNodeSpan

def content_size(text: str) -> int:
    """Calculate size as the number of non-whitespace characters."""
    return len("".join(text.split()))

def recursive_split(node: ASTNodeSpan, max_chars: int, source_bytes: bytes) -> List[ASTNodeSpan]:
    """
    Recursively split an AST node into structural units that fit within max_chars.
    """
    node_text = source_bytes[node.start_byte:node.end_byte].decode('utf-8', 'replace')
    if content_size(node_text) <= max_chars:
        return [node]
    
    if not node.children:
        return [node]
        
    units = []
    current_byte = node.start_byte
    
    for child in node.children:
        if child.start_byte > current_byte:
            # Yield the gap as a unit
            gap_span = ASTNodeSpan(
                start_byte=current_byte,
                end_byte=child.start_byte,
                start_line=node.start_line, # approximate
                end_line=child.start_line,
                children=[]
            )
            units.extend(recursive_split(gap_span, max_chars, source_bytes))
            
        units.extend(recursive_split(child, max_chars, source_bytes))
        current_byte = child.end_byte
        
    if current_byte < node.end_byte:
        gap_span = ASTNodeSpan(
            start_byte=current_byte,
            end_byte=node.end_byte,
            start_line=node.children[-1].end_line if node.children else node.start_line,
            end_line=node.end_line,
            children=[]
        )
        units.extend(recursive_split(gap_span, max_chars, source_bytes))
        
    return units

def greedy_pack(units: List[ASTNodeSpan], max_chars: int, source_bytes: bytes) -> List[Tuple[int, int, int, int]]:
    """
    Greedily pack adjacent structural units into chunks.
    Returns a list of tuples: (start_byte, end_byte, start_line, end_line)
    """
    chunks = []
    if not units:
        return chunks
        
    current_start_byte = units[0].start_byte
    current_end_byte = units[0].end_byte
    current_start_line = units[0].start_line
    current_end_line = units[0].end_line
    
    for unit in units[1:]:
        # Calculate the potential new end_byte if we include this unit
        proposed_end_byte = max(current_end_byte, unit.end_byte)
        proposed_text = source_bytes[current_start_byte:proposed_end_byte].decode('utf-8', 'replace')
        
        if content_size(proposed_text) <= max_chars:
            # It fits, merge it
            current_end_byte = proposed_end_byte
            current_end_line = max(current_end_line, unit.end_line)
            # start_byte and start_line remain the same
        else:
            # It doesn't fit, finalize the current chunk
            chunks.append((current_start_byte, current_end_byte, current_start_line, current_end_line))
            # Start a new chunk with the current unit
            current_start_byte = unit.start_byte
            current_end_byte = unit.end_byte
            current_start_line = unit.start_line
            current_end_line = unit.end_line
            
    # Add the last chunk
    chunks.append((current_start_byte, current_end_byte, current_start_line, current_end_line))
    return chunks
