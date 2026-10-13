import pytest
from uuid import uuid4
from app.services.chunking.algorithm import content_size, recursive_split, greedy_pack
from app.services.chunking.models import ASTNodeSpan, ChunkData
from app.services.chunking.line_chunker import LineChunker
from app.services.chunking.ast_chunker import ASTChunker
from app.models.knowledge import Symbol

def test_content_size():
    # Only non-whitespace characters are counted
    text = "def foo():\n    pass"
    assert content_size(text) == len("deffoo():pass")

def test_line_chunker():
    chunker = LineChunker(max_chars=20)
    source = b"line 1 is here\nline 2 is here\nline 3 is here"
    # size of "line1ishere" = 11.
    # line 1 + line 2 = "line1ishere" + "line2ishere" = 22 > 20.
    # So line chunker should split each line into its own chunk.
    file_id = uuid4()
    chunks = chunker.chunk(file_id, "test.txt", "text", source)
    
    assert len(chunks) == 3
    assert chunks[0].content == "line 1 is here\n"
    assert chunks[0].start_line == 1
    assert chunks[0].end_line == 1
    
    assert chunks[1].content == "line 2 is here\n"
    assert chunks[1].start_line == 2
    assert chunks[1].end_line == 2

def test_ast_chunker_fallback():
    chunker = ASTChunker(max_chars=100)
    file_id = uuid4()
    # "unsupported" language should fallback to LineChunker
    chunks = chunker.chunk(file_id, "test.md", "markdown", b"# Heading\n\nSome text", [])
    assert len(chunks) == 1
    assert chunks[0].content == "# Heading\n\nSome text"

def test_ast_chunker_symbol_assignment():
    chunker = ASTChunker(max_chars=100)
    file_id = uuid4()
    sym_id = uuid4()
    
    # Mock a symbol from line 1 to 5
    symbol = Symbol(
        id=sym_id,
        file_id=file_id,
        name="test_func",
        qualified_name="test_func",
        symbol_type="function",
        start_line=1,
        end_line=5
    )
    
    source = b"def test_func():\n    a = 1\n    b = 2\n    c = 3\n    return a + b + c"
    # size of source is small, should be 1 chunk.
    chunks = chunker.chunk(file_id, "test.py", "python", source, [symbol])
    
    assert len(chunks) == 1
    assert chunks[0].symbol_id == sym_id

def test_ast_chunker_recursive_split():
    # If a function is too large, it should be split.
    # We will set a very small max_chars (e.g. 10) to force splitting.
    chunker = ASTChunker(max_chars=10)
    file_id = uuid4()
    
    source = b"def small():\n    a = 1\n    b = 2\n    return a + b"
    # non-whitespace chars: 
    # "defsmall():" = 11 (already > 10, so it will split into children)
    # The children of ast.Module are ast.FunctionDef
    # The children of ast.FunctionDef are args and body (Assign, Assign, Return)
    
    chunks = chunker.chunk(file_id, "test.py", "python", source, [])
    
    # It should split into multiple chunks
    assert len(chunks) > 1
    
    # Reassembling chunks should give back the exact original source, preserving whitespace!
    assembled = ""
    for c in chunks:
        assembled += c.content
        
    assert assembled == source.decode('utf-8')


def test_chunk_builder_service_skips_path_traversal(tmp_path):
    from unittest.mock import MagicMock
    from app.services.chunking.service import ChunkBuilderService
    from app.models.knowledge import File

    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    secret_file = tmp_path / "secret.py"
    secret_file.write_text("SECRET = 'hidden'")

    valid_file = repo_dir / "valid.py"
    valid_file.write_text("def hello(): pass")

    knowledge_repo = MagicMock()
    knowledge_repo.db.execute.return_value.scalars.return_value.all.return_value = []

    service = ChunkBuilderService(knowledge_repo, str(repo_dir))

    traversal_file = File(
        id=uuid4(),
        repository_version_id=uuid4(),
        file_path="../secret.py",
        file_name="secret.py",
        language="python",
        size_bytes=len("SECRET = 'hidden'"),
        hash="hash1"
    )

    legit_file = File(
        id=uuid4(),
        repository_version_id=uuid4(),
        file_path="valid.py",
        file_name="valid.py",
        language="python",
        size_bytes=len("def hello(): pass"),
        hash="hash2"
    )

    stats = service.build_chunks(MagicMock(), [traversal_file, legit_file])

    assert stats["files_skipped"] == 1
    assert stats["files_processed"] == 1
    assert stats["chunks_created"] == 1
    knowledge_repo.delete_chunks_for_files.assert_called_once()
    created_chunks = knowledge_repo.bulk_create_code_chunks.call_args[0][0]
    assert len(created_chunks) == 1
    assert created_chunks[0].file_id == legit_file.id
