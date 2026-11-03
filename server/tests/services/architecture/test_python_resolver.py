"""Unit tests for Python AST import resolver."""

from pathlib import Path
from app.services.architecture.resolvers.python import PythonResolver
from app.services.architecture.reader import create_repo_reader


def test_python_resolver_pure_in_memory():
    """Verify resolver is completely pure and works with in-memory fixtures."""
    files_data = {
        "app/main.py": "import os\nfrom app.utils import add\nfrom app.models import User",
        "app/utils.py": "def add(a, b):\n    return a + b",
        "app/models.py": "class User:\n    pass",
    }
    file_index = [(k, "python") for k in files_data.keys()]
    reader = lambda p: files_data[p]

    resolver = PythonResolver()
    evidences, unparseable = resolver.resolve(file_index, reader)

    assert unparseable == []
    # os is external stdlib
    os_ev = next(e for e in evidences if e.specifier == "os")
    assert os_ev.kind == "external"
    assert os_ev.target_file is None

    # app.utils resolves to app/utils.py
    utils_ev = next(e for e in evidences if "utils" in e.specifier)
    assert utils_ev.kind == "internal"
    assert utils_ev.target_file == "app/utils.py"

    # app.models resolves to app/models.py
    models_ev = next(e for e in evidences if "models" in e.specifier)
    assert models_ev.kind == "internal"
    assert models_ev.target_file == "app/models.py"


def test_python_resolver_submodule_vs_symbol():
    """Verify rule: from pkg import name (try pkg.name module, then pkg/__init__)."""
    files_data = {
        "pkg/__init__.py": "symbol_var = 123",
        "pkg/submod.py": "def sub(): pass",
        "consumer.py": "from pkg import submod\nfrom pkg import symbol_var",
    }
    file_index = [(k, "python") for k in files_data.keys()]
    reader = lambda p: files_data[p]

    resolver = PythonResolver()
    evidences, unparseable = resolver.resolve(file_index, reader)

    # submod should resolve to pkg/submod.py
    submod_ev = next(e for e in evidences if e.specifier == "pkg.submod")
    assert submod_ev.kind == "internal"
    assert submod_ev.target_file == "pkg/submod.py"

    # symbol_var should resolve to pkg/__init__.py
    symbol_ev = next(e for e in evidences if e.specifier == "pkg.symbol_var")
    assert symbol_ev.kind == "internal"
    assert symbol_ev.target_file == "pkg/__init__.py"


def test_python_resolver_relative_imports_and_cycles():
    """Verify relative imports and cyclic imports resolve cleanly."""
    files_data = {
        "pkg/__init__.py": "",
        "pkg/a.py": "from .b import func_b",
        "pkg/b.py": "from .a import func_a",
    }
    file_index = [(k, "python") for k in files_data.keys()]
    reader = lambda p: files_data[p]

    resolver = PythonResolver()
    evidences, unparseable = resolver.resolve(file_index, reader)

    ev_a = next(e for e in evidences if e.source_file == "pkg/a.py")
    assert ev_a.kind == "internal"
    assert ev_a.target_file == "pkg/b.py"

    ev_b = next(e for e in evidences if e.source_file == "pkg/b.py")
    assert ev_b.kind == "internal"
    assert ev_b.target_file == "pkg/a.py"


def test_python_resolver_namespace_package():
    """Verify PEP 420 namespace package resolution without __init__.py."""
    files_data = {
        "namespace_dir/core.py": "from namespace_dir.sub.helper import work",
        "namespace_dir/sub/helper.py": "def work(): return 1",
    }
    file_index = [(k, "python") for k in files_data.keys()]
    reader = lambda p: files_data[p]

    resolver = PythonResolver()
    evidences, unparseable = resolver.resolve(file_index, reader)

    ev = next(e for e in evidences if e.source_file == "namespace_dir/core.py")
    assert ev.kind == "internal"
    assert ev.target_file == "namespace_dir/sub/helper.py"


def test_python_resolver_ambiguous_matches():
    """Verify ambiguous match marks import as unresolved (never guess)."""
    files_data = {
        "service1/utils.py": "def u1(): pass",
        "service2/utils.py": "def u2(): pass",
        "consumer.py": "import utils",
    }
    file_index = [(k, "python") for k in files_data.keys()]
    reader = lambda p: files_data[p]

    resolver = PythonResolver()
    evidences, unparseable = resolver.resolve(file_index, reader)

    ev = next(e for e in evidences if e.source_file == "consumer.py")
    assert ev.kind == "unresolved"
    assert ev.target_file is None


def test_python_resolver_unparseable_files():
    """Verify SyntaxError, ValueError, RecursionError do not crash and are marked unparseable."""
    files_data = {
        "good.py": "import sys",
        "bad_syntax.py": "def broken(:",
    }
    file_index = [(k, "python") for k in files_data.keys()]
    reader = lambda p: files_data[p]

    resolver = PythonResolver()
    evidences, unparseable = resolver.resolve(file_index, reader)

    assert "bad_syntax.py" in unparseable
    assert len(evidences) == 1
    assert evidences[0].specifier == "sys"


def test_python_resolver_timeout_budget():
    """Verify injected clock triggers timeout budget enforcement."""
    files_data = {
        "f1.py": "import sys",
        "f2.py": "import os",
    }
    file_index = [(k, "python") for k in files_data.keys()]
    reader = lambda p: files_data[p]

    # Mock clock that advances past timeout after first file
    calls = [0.0, 0.0, 100.0]
    clock_fn = lambda: calls.pop(0) if calls else 300.0

    resolver = PythonResolver()
    evidences, _ = resolver.resolve(file_index, reader, clock=clock_fn, timeout_seconds=10.0)

    # Only first file should be processed before timeout
    assert len(evidences) == 1


def test_python_resolver_on_fixtures_disk():
    """Verify resolver on real disk fixture server/tests/fixtures/architecture/python_pkg."""
    fixture_dir = Path("server/tests/fixtures/architecture/python_pkg").resolve()
    assert fixture_dir.is_dir()

    reader = create_repo_reader(fixture_dir)
    files = [
        ("my_pkg/__init__.py", "python"),
        ("my_pkg/submod_a.py", "python"),
        ("my_pkg/submod_b.py", "python"),
        ("sibling.py", "python"),
        ("ns_pkg/component/core.py", "python"),
        ("ns_pkg/component/util.py", "python"),
        ("broken_syntax.py", "python"),
        ("main.py", "python"),
    ]

    resolver = PythonResolver()
    evidences, unparseable = resolver.resolve(files, reader)

    assert "broken_syntax.py" in unparseable

    # Check main.py imports
    main_evs = [e for e in evidences if e.source_file == "main.py"]
    sys_ev = next(e for e in main_evs if e.specifier == "sys")
    assert sys_ev.kind == "external"

    pkg_ev = next(e for e in main_evs if "FuncA" in e.specifier)
    assert pkg_ev.kind == "internal"
    assert pkg_ev.target_file == "my_pkg/__init__.py"

    ns_ev = next(e for e in main_evs if "ns_pkg" in e.specifier)
    assert ns_ev.kind == "internal"
    assert ns_ev.target_file == "ns_pkg/component/core.py"
