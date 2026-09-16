"""
Real Tree-sitter parser integration tests.

These tests invoke the *actual* tree-sitter parser binaries.  They are
automatically skipped when the native extensions are not available (e.g. on a
Windows CI runner that cannot compile C extensions).

Run explicitly with:
    pytest tests/services/test_symbol_extractor_real.py -v
"""
import os
import sys
import pytest
from unittest.mock import MagicMock
from uuid import uuid4


def _real_module_available(name: str) -> bool:
    """Return True only if the named module is importable AND is a real C-extension
    (not a MagicMock injected by another test file)."""
    mod = sys.modules.get(name)
    if mod is not None and isinstance(mod, MagicMock):
        return False
    try:
        import importlib
        real = importlib.import_module(name)
        return not isinstance(real, MagicMock)
    except ImportError:
        return False


_TREE_SITTER_AVAILABLE = (
    _real_module_available("tree_sitter")
    and _real_module_available("tree_sitter_javascript")
    and _real_module_available("tree_sitter_typescript")
)

pytestmark = pytest.mark.skipif(
    not _TREE_SITTER_AVAILABLE,
    reason="Real tree-sitter native extensions not installed",
)

from app.models.knowledge import File
from app.services.symbol_extractor.javascript_extractor import JavaScriptExtractor
from app.services.symbol_extractor.python_extractor import PythonExtractor


def make_file(path: str, language: str) -> File:
    return File(
        id=uuid4(),
        repository_version_id=uuid4(),
        file_path=path,
        file_name=os.path.basename(path),
        language=language,
        size_bytes=0,
        hash="test",
    )


# ---------------------------------------------------------------------------
# JavaScript – real parser
# ---------------------------------------------------------------------------

class TestJavaScriptReal:
    def setup_method(self):
        self.extractor = JavaScriptExtractor("javascript")

    def test_function_declaration(self):
        source = b"function calculateScore() { return 42; }"
        syms = self.extractor.extract(make_file("a.js", "javascript"), source)
        names = {s.name: s for s in syms}
        assert "calculateScore" in names
        assert names["calculateScore"].symbol_type == "function"

    def test_arrow_function_variable(self):
        source = b"const add = (a, b) => a + b;"
        syms = self.extractor.extract(make_file("a.js", "javascript"), source)
        names = {s.name: s for s in syms}
        assert "add" in names
        assert names["add"].symbol_type == "function"

    def test_class_and_method(self):
        source = b"""
class Animal {
    constructor(name) { this.name = name; }
    speak() { return this.name; }
}
"""
        syms = self.extractor.extract(make_file("a.js", "javascript"), source)
        types = {s.name: s.symbol_type for s in syms}
        assert "Animal" in types
        assert types["Animal"] == "class"
        assert "speak" in types
        assert types["speak"] == "method"

    def test_named_import(self):
        source = b"import { useState } from 'react';"
        syms = self.extractor.extract(make_file("a.js", "javascript"), source)
        import_syms = [s for s in syms if s.symbol_type == "import"]
        assert any(s.name == "useState" for s in import_syms)

    def test_default_import(self):
        source = b"import React from 'react';"
        syms = self.extractor.extract(make_file("a.js", "javascript"), source)
        import_syms = [s for s in syms if s.symbol_type == "import"]
        assert any(s.name == "React" for s in import_syms)

    def test_line_numbers_are_1_based(self):
        source = b"function foo() {}\nfunction bar() {}\n"
        syms = self.extractor.extract(make_file("a.js", "javascript"), source)
        foo = next((s for s in syms if s.name == "foo"), None)
        assert foo is not None
        assert foo.start_line == 1  # 1-based

    def test_normal_function_not_hook(self):
        """'user', 'useful', 'usecase' must not be classified as hook."""
        for bad_name in ("user", "useful", "usecase", "usedAt"):
            source = f"function {bad_name}() {{}}".encode()
            syms = self.extractor.extract(make_file("a.js", "javascript"), source)
            func = next((s for s in syms if s.name == bad_name), None)
            assert func is not None, f"Symbol {bad_name!r} not found"
            assert func.symbol_type == "function", (
                f"{bad_name!r} should be 'function', got {func.symbol_type!r}"
            )

    def test_hook_detection(self):
        """useAuth, useUser, useRepository must be classified as hook."""
        for hook_name in ("useAuth", "useUser", "useRepository"):
            source = f"function {hook_name}() {{}}".encode()
            syms = self.extractor.extract(make_file("a.js", "javascript"), source)
            hook = next((s for s in syms if s.name == hook_name), None)
            assert hook is not None
            assert hook.symbol_type == "hook", (
                f"{hook_name!r} should be 'hook', got {hook.symbol_type!r}"
            )

    def test_malformed_js_returns_empty(self):
        """Malformed JS (has_error=True) must return an empty symbol list."""
        source = b"function {{{ class ;;;"
        syms = self.extractor.extract(make_file("bad.js", "javascript"), source)
        assert syms == [], "Malformed JS should yield no symbols"


# ---------------------------------------------------------------------------
# JSX – real parser (JS grammar supports JSX)
# ---------------------------------------------------------------------------

class TestJSXReal:
    def setup_method(self):
        self.extractor = JavaScriptExtractor("jsx")

    def test_jsx_component(self):
        source = b"""
function UserCard() {
    return <div className="card">Hello</div>;
}
"""
        syms = self.extractor.extract(make_file("card.jsx", "jsx"), source)
        names = {s.name: s for s in syms}
        assert "UserCard" in names
        assert names["UserCard"].symbol_type == "component"

    def test_normal_function_in_jsx_file(self):
        source = b"function calculateScore() { return 42; }"
        syms = self.extractor.extract(make_file("util.jsx", "jsx"), source)
        names = {s.name: s for s in syms}
        assert "calculateScore" in names
        assert names["calculateScore"].symbol_type == "function"

    def test_arrow_component(self):
        source = b"const Button = () => <button>Click</button>;"
        syms = self.extractor.extract(make_file("btn.jsx", "jsx"), source)
        names = {s.name: s for s in syms}
        assert "Button" in names
        assert names["Button"].symbol_type == "component"


# ---------------------------------------------------------------------------
# TypeScript – real parser
# ---------------------------------------------------------------------------

class TestTypeScriptReal:
    def setup_method(self):
        self.extractor = JavaScriptExtractor("typescript")

    def test_interface(self):
        source = b"interface User { id: number; name: string; }"
        syms = self.extractor.extract(make_file("a.ts", "typescript"), source)
        names = {s.name: s for s in syms}
        assert "User" in names
        assert names["User"].symbol_type == "interface"

    def test_type_alias(self):
        source = b"type UserId = string;"
        syms = self.extractor.extract(make_file("a.ts", "typescript"), source)
        names = {s.name: s for s in syms}
        assert "UserId" in names
        assert names["UserId"].symbol_type == "type"

    def test_enum(self):
        source = b"enum Status { Active, Inactive }"
        syms = self.extractor.extract(make_file("a.ts", "typescript"), source)
        names = {s.name: s for s in syms}
        assert "Status" in names
        assert names["Status"].symbol_type == "enum"

    def test_class_with_method(self):
        source = b"""
class UserService {
    getUser(id: string): User { return {} as User; }
}
"""
        syms = self.extractor.extract(make_file("a.ts", "typescript"), source)
        types = {s.name: s.symbol_type for s in syms}
        assert types.get("UserService") == "class"
        assert types.get("getUser") == "method"


# ---------------------------------------------------------------------------
# TSX – real parser (TypeScript TSX grammar)
# ---------------------------------------------------------------------------

class TestTSXReal:
    def setup_method(self):
        self.extractor = JavaScriptExtractor("tsx")

    def test_tsx_component_with_ts_types(self):
        source = b"""
interface Props { label: string; }
function Badge({ label }: Props) {
    return <span>{label}</span>;
}
"""
        syms = self.extractor.extract(make_file("badge.tsx", "tsx"), source)
        types = {s.name: s.symbol_type for s in syms}
        assert types.get("Props") == "interface"
        assert types.get("Badge") == "component"

    def test_tsx_arrow_component(self):
        source = b"const Card = (): JSX.Element => <div />;"
        syms = self.extractor.extract(make_file("card.tsx", "tsx"), source)
        names = {s.name: s for s in syms}
        assert "Card" in names
        assert names["Card"].symbol_type == "component"
