import pytest
import os
import sys
from unittest.mock import MagicMock, patch
from uuid import uuid4

# Mock tree-sitter modules for Windows environment where it couldn't compile
sys.modules['tree_sitter'] = MagicMock()
sys.modules['tree_sitter_javascript'] = MagicMock()
sys.modules['tree_sitter_typescript'] = MagicMock()

from app.models.knowledge import File, Symbol
from app.services.symbol_extractor.python_extractor import PythonExtractor
from app.services.symbol_extractor.javascript_extractor import JavaScriptExtractor
from app.services.symbol_extractor.service import SymbolExtractorService

@pytest.fixture
def python_extractor():
    return PythonExtractor()

def create_file(path: str, language: str) -> File:
    return File(
        id=uuid4(),
        repository_version_id=uuid4(),
        file_path=path,
        file_name=os.path.basename(path),
        language=language,
        size_bytes=100,
        hash="hash"
    )

def test_python_extraction_basic(python_extractor):
    source = b"""
import os
from datetime import datetime

class UserService:
    def get_user(self):
        def inner():
            pass
        return None

async def fetch_data():
    pass
"""
    file = create_file("main.py", "python")
    symbols = python_extractor.extract(file, source)
    
    assert len(symbols) == 6
    # os
    assert any(s.name == "os" and s.symbol_type == "import" for s in symbols)
    # datetime
    assert any(s.name == "datetime" and s.symbol_type == "import" for s in symbols)
    # UserService
    assert any(s.name == "UserService" and s.symbol_type == "class" for s in symbols)
    # get_user
    assert any(s.name == "get_user" and s.symbol_type == "method" and s.qualified_name == "UserService.get_user" for s in symbols)
    # inner (gets classified as method due to scope stack)
    assert any(s.name == "inner" and s.symbol_type == "method" and s.qualified_name == "UserService.get_user.inner" for s in symbols)
    # fetch_data
    assert any(s.name == "fetch_data" and s.symbol_type == "function" for s in symbols)

def test_python_extraction_export(python_extractor):
    source = b"""
__all__ = ["foo", "bar"]
def foo(): pass
def bar(): pass
"""
    file = create_file("mod.py", "python")
    symbols = python_extractor.extract(file, source)
    exports = [s for s in symbols if s.symbol_type == "export"]
    assert len(exports) == 2
    assert any(e.name == "foo" for e in exports)
    assert any(e.name == "bar" for e in exports)

def test_python_extraction_malformed(python_extractor):
    source = b"""class def foo(): pass"""
    file = create_file("bad.py", "python")
    with pytest.raises(ValueError, match="Malformed Python"):
        python_extractor.extract(file, source)

@patch('app.services.symbol_extractor.javascript_extractor.Parser')
@patch('app.services.symbol_extractor.javascript_extractor.Language')
def test_javascript_extraction(mock_language, mock_parser_class):
    # We will mock the AST for a simple JS file
    mock_parser = MagicMock()
    mock_parser_class.return_value = mock_parser
    
    mock_tree = MagicMock()
    mock_root = MagicMock()
    mock_root.has_error = False
    
    # Mocking a function declaration node
    func_node = MagicMock()
    func_node.type = "function_declaration"
    func_name = MagicMock()
    func_name.start_byte = 9
    func_name.end_byte = 12
    func_node.child_by_field_name.return_value = func_name
    func_node.start_point = (0, 0)
    func_node.end_point = (2, 1)
    func_node.children = []
    
    mock_root.children = [func_node]
    mock_tree.root_node = mock_root
    mock_parser.parse.return_value = mock_tree
    
    extractor = JavaScriptExtractor("javascript")
    
    # The source code string
    source = b"function foo() {}"
    file = create_file("main.js", "javascript")
    symbols = extractor.extract(file, source)
    
    assert len(symbols) == 1
    assert symbols[0].name == "foo"
    assert symbols[0].symbol_type == "function"
    assert symbols[0].start_line == 1
    assert symbols[0].end_line == 3

@patch('app.services.symbol_extractor.javascript_extractor.Parser')
@patch('app.services.symbol_extractor.javascript_extractor.Language')
def test_react_extraction(mock_language, mock_parser_class):
    mock_parser = MagicMock()
    mock_parser_class.return_value = mock_parser
    
    mock_tree = MagicMock()
    mock_root = MagicMock()
    mock_root.has_error = False
    
    # Function with JSX
    func_node = MagicMock()
    func_node.type = "function_declaration"
    func_name = MagicMock()
    func_name.start_byte = 9
    func_name.end_byte = 17
    
    jsx_node = MagicMock()
    jsx_node.type = "jsx_element"
    jsx_node.children = []
    
    func_node.child_by_field_name.return_value = func_name
    func_node.start_point = (0, 0)
    func_node.end_point = (2, 1)
    func_node.children = [jsx_node]
    
    # Hook function
    hook_node = MagicMock()
    hook_node.type = "function_declaration"
    hook_name = MagicMock()
    hook_name.start_byte = 50
    hook_name.end_byte = 57
    hook_node.child_by_field_name.return_value = hook_name
    hook_node.start_point = (4, 0)
    hook_node.end_point = (5, 1)
    hook_node.children = []
    
    mock_root.children = [func_node, hook_node]
    mock_tree.root_node = mock_root
    mock_parser.parse.return_value = mock_tree
    
    extractor = JavaScriptExtractor("tsx")
    
    source = b"function UserCard() { return <div />; }\n\nfunction useAuth() {}"
    file = create_file("component.tsx", "tsx")
    symbols = extractor.extract(file, source)
    
    assert len(symbols) == 2
    assert symbols[0].name == "UserCard"
    assert symbols[0].symbol_type == "component"
    
    assert symbols[1].name == "useAuth"
    assert symbols[1].symbol_type == "hook"

def test_symbol_extractor_service_idempotency(tmp_path):
    # Setup mock repo and files
    knowledge_repo = MagicMock()
    
    # Create temp source file
    source_path = tmp_path / "main.py"
    source_path.write_text("def foo(): pass")
    
    file = create_file("main.py", "python")
    
    service = SymbolExtractorService(knowledge_repo, str(tmp_path))
    
    # Run once
    stats1 = service.extract_symbols(MagicMock(), [file])
    assert stats1["symbols_extracted"] == 1
    
    knowledge_repo.delete_symbols_for_files.assert_called_once_with([file.id])
    assert knowledge_repo.bulk_create_symbols.call_count == 1
    inserted_symbols = knowledge_repo.bulk_create_symbols.call_args[0][0]
    assert len(inserted_symbols) == 1
    assert inserted_symbols[0].name == "foo"
    
    # Change source code
    source_path.write_text("def bar(): pass")
    
    # Run again (simulate retry with changed content)
    knowledge_repo.reset_mock()
    stats2 = service.extract_symbols(MagicMock(), [file])
    assert stats2["symbols_extracted"] == 1
    
    knowledge_repo.delete_symbols_for_files.assert_called_once_with([file.id])
    inserted_symbols_retry = knowledge_repo.bulk_create_symbols.call_args[0][0]
    assert len(inserted_symbols_retry) == 1
    assert inserted_symbols_retry[0].name == "bar"

def test_symbol_extractor_service_malformed_isolation(tmp_path):
    knowledge_repo = MagicMock()
    
    # Create good and bad files
    good_path = tmp_path / "good.py"
    good_path.write_text("def foo(): pass")
    
    bad_path = tmp_path / "bad.py"
    bad_path.write_text("class def =")
    
    good_file = create_file("good.py", "python")
    bad_file = create_file("bad.py", "python")
    unsupported_file = create_file("unknown.txt", "unknown")
    
    service = SymbolExtractorService(knowledge_repo, str(tmp_path))
    
    stats = service.extract_symbols(MagicMock(), [good_file, bad_file, unsupported_file])
    
    assert stats["files_processed"] == 1
    assert stats["files_skipped"] == 2
    assert stats["files_skipped_unsupported_language"] == 1
    assert stats["files_skipped_malformed"] == 1
    assert stats["symbols_extracted"] == 1
    
    # verify only good symbol was persisted
    inserted_symbols = knowledge_repo.bulk_create_symbols.call_args[0][0]
    assert len(inserted_symbols) == 1
    assert inserted_symbols[0].name == "foo"
