"""
Unit tests for the symbol extractor package.

Tree-sitter native binaries are not required here — JS/TS tests use per-test
sys.modules patching via autouse fixtures so that the mock does NOT leak into
other test modules collected in the same pytest session.
"""
import os
import sys
import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.models.knowledge import File, Symbol
from app.services.symbol_extractor.python_extractor import PythonExtractor
from app.services.symbol_extractor.service import SymbolExtractorService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def create_file(path: str, language: str) -> File:
    return File(
        id=uuid4(),
        repository_version_id=uuid4(),
        file_path=path,
        file_name=os.path.basename(path),
        language=language,
        size_bytes=100,
        hash="hash",
    )


@pytest.fixture()
def python_extractor():
    return PythonExtractor()


@pytest.fixture()
def ts_module_mock(monkeypatch):
    """
    Patch tree-sitter imports per-test.  Using monkeypatch ensures the
    sys.modules changes are automatically rolled back after each test so
    they do NOT leak into other modules or test files.
    """
    mock_ts = MagicMock()
    mock_ts_js = MagicMock()
    mock_ts_ts = MagicMock()
    monkeypatch.setitem(sys.modules, 'tree_sitter', mock_ts)
    monkeypatch.setitem(sys.modules, 'tree_sitter_javascript', mock_ts_js)
    monkeypatch.setitem(sys.modules, 'tree_sitter_typescript', mock_ts_ts)

    # Re-import the extractor module so it picks up the mocked modules.
    # We do a local import inside each JS/TS test to avoid stale imports.
    return mock_ts, mock_ts_js, mock_ts_ts


def _make_js_extractor(language: str):
    """Import JavaScriptExtractor inside a test after the mock is in place."""
    # Force a fresh attribute lookup by importing from the already-loaded module.
    # Since python caches modules, the class is always the same object; the
    # monkeypatched sys.modules just controls what Language/Parser resolve to.
    from app.services.symbol_extractor.javascript_extractor import JavaScriptExtractor
    return JavaScriptExtractor(language)


# ---------------------------------------------------------------------------
# Python extractor — real ast parsing, no mocks needed
# ---------------------------------------------------------------------------

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
    assert any(s.name == "os" and s.symbol_type == "import" for s in symbols)
    assert any(s.name == "datetime" and s.symbol_type == "import" for s in symbols)
    assert any(s.name == "UserService" and s.symbol_type == "class" for s in symbols)
    assert any(
        s.name == "get_user"
        and s.symbol_type == "method"
        and s.qualified_name == "UserService.get_user"
        for s in symbols
    )
    # Nested function inside get_user must be "function", NOT "method"
    assert any(
        s.name == "inner"
        and s.symbol_type == "function"
        and s.qualified_name == "UserService.get_user.inner"
        for s in symbols
    )
    assert any(s.name == "fetch_data" and s.symbol_type == "function" for s in symbols)


def test_python_nested_function_is_not_method(python_extractor):
    """A function nested inside another function must be 'function', not 'method'."""
    source = b"""
def outer():
    def inner():
        pass
"""
    file = create_file("nested.py", "python")
    symbols = python_extractor.extract(file, source)

    inner = next((s for s in symbols if s.name == "inner"), None)
    assert inner is not None
    assert inner.symbol_type == "function", (
        f"Expected 'function' for nested function, got {inner.symbol_type!r}"
    )
    assert inner.qualified_name == "outer.inner"


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


def test_python_import_from_qualified_name(python_extractor):
    """from x import y → name='y', qualified_name='y' (no artificial module prefix)."""
    source = b"from datetime import datetime\n"
    file = create_file("mod.py", "python")
    symbols = python_extractor.extract(file, source)
    dt = next((s for s in symbols if s.name == "datetime"), None)
    assert dt is not None
    assert dt.symbol_type == "import"
    assert dt.qualified_name == "datetime"  # NOT "datetime.datetime"


def test_python_import_alias(python_extractor):
    """from x import y as z → name='z'."""
    source = b"from pathlib import Path as P\n"
    file = create_file("mod.py", "python")
    symbols = python_extractor.extract(file, source)
    p = next((s for s in symbols if s.name == "P"), None)
    assert p is not None
    assert p.symbol_type == "import"


def test_python_extraction_malformed(python_extractor):
    source = b"""class def foo(): pass"""
    file = create_file("bad.py", "python")
    with pytest.raises(ValueError, match="Malformed Python"):
        python_extractor.extract(file, source)


# ---------------------------------------------------------------------------
# JavaScript extractor — mocked Tree-sitter, per-test scope
# ---------------------------------------------------------------------------

def test_javascript_extraction(ts_module_mock):
    mock_parser = MagicMock()

    mock_tree = MagicMock()
    mock_root = MagicMock()
    mock_root.has_error = False

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

    extractor = _make_js_extractor("javascript")
    extractor.parser = mock_parser  # inject directly — bypasses TREE_SITTER_AVAILABLE
    source = b"function foo() {}"
    file = create_file("main.js", "javascript")
    symbols = extractor.extract(file, source)

    assert len(symbols) == 1
    assert symbols[0].name == "foo"
    assert symbols[0].symbol_type == "function"
    assert symbols[0].start_line == 1
    assert symbols[0].end_line == 3


def test_react_component_extraction(ts_module_mock):
    mock_parser = MagicMock()

    mock_tree = MagicMock()
    mock_root = MagicMock()
    mock_root.has_error = False

    # UserCard function with JSX child
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

    # useAuth: source "function UserCard() { ... }\n\nfunction useAuth() {}"
    # useAuth starts at byte 50
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

    extractor = _make_js_extractor("tsx")
    extractor.parser = mock_parser  # inject directly
    source = b"function UserCard() { return <div />; }\n\nfunction useAuth() {}"
    file = create_file("component.tsx", "tsx")
    symbols = extractor.extract(file, source)

    assert len(symbols) == 2
    assert symbols[0].name == "UserCard"
    assert symbols[0].symbol_type == "component"
    assert symbols[1].name == "useAuth"
    assert symbols[1].symbol_type == "hook"


def test_hook_detection_false_positives(ts_module_mock):
    """Names like 'user', 'usedAt', 'usecase' must NOT be classified as hook."""
    for bad_name in ("user", "usedAt", "usecase", "useful", "username"):
        source_str = f"function {bad_name}() {{}}".encode()

        mock_parser = MagicMock()
        mock_tree = MagicMock()
        mock_root = MagicMock()
        mock_root.has_error = False
        mock_tree.root_node = mock_root
        mock_parser.parse.return_value = mock_tree

        func_node = MagicMock()
        func_node.type = "function_declaration"
        func_name_node = MagicMock()
        func_name_node.start_byte = 9
        func_name_node.end_byte = 9 + len(bad_name)
        func_node.child_by_field_name.return_value = func_name_node
        func_node.start_point = (0, 0)
        func_node.end_point = (0, len(source_str))
        func_node.children = []
        mock_root.children = [func_node]

        extractor = _make_js_extractor("javascript")
        extractor.parser = mock_parser  # inject directly
        file = create_file("test.js", "javascript")
        symbols = extractor.extract(file, source_str)

        assert len(symbols) == 1, f"Expected 1 symbol for name {bad_name!r}"
        assert symbols[0].symbol_type != "hook", (
            f"Name {bad_name!r} incorrectly classified as 'hook'"
        )


def test_malformed_js_returns_empty(ts_module_mock):
    """When tree.root_node.has_error is True the extractor must return []."""
    mock_parser = MagicMock()
    mock_tree = MagicMock()
    mock_root = MagicMock()
    mock_root.has_error = True
    mock_root.children = []
    mock_tree.root_node = mock_root
    mock_parser.parse.return_value = mock_tree

    extractor = _make_js_extractor("javascript")
    extractor.parser = mock_parser  # inject directly
    file = create_file("bad.js", "javascript")
    symbols = extractor.extract(file, b"function {{{}") 
    assert symbols == [], "Malformed JS must yield no symbols"


# ---------------------------------------------------------------------------
# SymbolExtractorService — integration / behaviour tests (no Tree-sitter needed)
# ---------------------------------------------------------------------------

def test_symbol_extractor_service_idempotency(tmp_path):
    knowledge_repo = MagicMock()

    (tmp_path / "main.py").write_text("def foo(): pass")
    file = create_file("main.py", "python")

    service = SymbolExtractorService(knowledge_repo, str(tmp_path))

    # First run
    stats1 = service.extract_symbols(MagicMock(), [file])
    assert stats1["symbols_extracted"] == 1
    knowledge_repo.delete_symbols_for_files.assert_called_once_with([file.id])
    inserted = knowledge_repo.bulk_create_symbols.call_args[0][0]
    assert len(inserted) == 1
    assert inserted[0].name == "foo"

    # Second run — source changes
    (tmp_path / "main.py").write_text("def bar(): pass")
    knowledge_repo.reset_mock()

    stats2 = service.extract_symbols(MagicMock(), [file])
    assert stats2["symbols_extracted"] == 1
    knowledge_repo.delete_symbols_for_files.assert_called_once_with([file.id])
    inserted2 = knowledge_repo.bulk_create_symbols.call_args[0][0]
    assert inserted2[0].name == "bar"


def test_symbol_extractor_service_malformed_isolation(tmp_path):
    knowledge_repo = MagicMock()

    (tmp_path / "good.py").write_text("def foo(): pass")
    (tmp_path / "bad.py").write_text("class def =")

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
    inserted = knowledge_repo.bulk_create_symbols.call_args[0][0]
    assert len(inserted) == 1
    assert inserted[0].name == "foo"


def test_symbol_extractor_service_rollback_on_db_failure(tmp_path):
    """If bulk_create_symbols raises, the exception propagates and DELETE was already issued."""
    knowledge_repo = MagicMock()
    knowledge_repo.bulk_create_symbols.side_effect = RuntimeError("DB error")

    (tmp_path / "main.py").write_text("def foo(): pass")
    file = create_file("main.py", "python")

    service = SymbolExtractorService(knowledge_repo, str(tmp_path))
    with pytest.raises(RuntimeError, match="DB error"):
        service.extract_symbols(MagicMock(), [file])

    # DELETE was issued before the failed INSERT; caller must rollback
    knowledge_repo.delete_symbols_for_files.assert_called_once()


def test_symbol_extractor_service_file_isolation(tmp_path):
    """Processing file A must not delete symbols for file B."""
    knowledge_repo = MagicMock()

    (tmp_path / "a.py").write_text("def a(): pass")

    file_a = create_file("a.py", "python")
    file_b = create_file("b.py", "python")  # NOT in the batch

    service = SymbolExtractorService(knowledge_repo, str(tmp_path))
    service.extract_symbols(MagicMock(), [file_a])  # only file_a

    deleted_ids = knowledge_repo.delete_symbols_for_files.call_args[0][0]
    assert file_b.id not in deleted_ids, "File B's symbols must not be deleted"
