"""Unit tests for Tree-sitter based JavaScript/TypeScript import resolver."""

from pathlib import Path
from app.services.architecture.resolvers.javascript import JavaScriptResolver
from app.services.architecture.reader import create_repo_reader


def test_javascript_resolver_pure_in_memory():
    """Verify JS resolver is pure and resolves relative imports and index files."""
    files_data = {
        "src/App.tsx": 'import React from "react";\nimport { Button } from "./components/Button";\nimport { util } from "./utils";',
        "src/components/Button.tsx": 'export const Button = () => null;',
        "src/utils/index.ts": 'export const util = 1;',
    }
    file_index = [(k, "tsx" if k.endswith(".tsx") else "typescript") for k in files_data.keys()]
    reader = lambda p: files_data[p]

    resolver = JavaScriptResolver()
    evidences, unparseable = resolver.resolve(file_index, reader)

    assert unparseable == []

    # react is external
    react_ev = next(e for e in evidences if e.specifier == "react")
    assert react_ev.kind == "external"
    assert react_ev.target_file is None

    # ./components/Button resolves to src/components/Button.tsx
    btn_ev = next(e for e in evidences if "Button" in e.specifier)
    assert btn_ev.kind == "internal"
    assert btn_ev.target_file == "src/components/Button.tsx"

    # ./utils resolves to src/utils/index.ts
    util_ev = next(e for e in evidences if "utils" in e.specifier)
    assert util_ev.kind == "internal"
    assert util_ev.target_file == "src/utils/index.ts"


def test_javascript_resolver_js_to_ts_quirk():
    """Verify TS moduleResolution quirk: .js specifier resolving to .ts file."""
    files_data = {
        "src/index.ts": 'import { helper } from "./helper.js";',
        "src/helper.ts": 'export const helper = 42;',
    }
    file_index = [(k, "typescript") for k in files_data.keys()]
    reader = lambda p: files_data[p]

    resolver = JavaScriptResolver()
    evidences, unparseable = resolver.resolve(file_index, reader)

    assert unparseable == []
    ev = evidences[0]
    assert ev.specifier == "./helper.js"
    assert ev.kind == "internal"
    assert ev.target_file == "src/helper.ts"


def test_javascript_resolver_ignores_comments_and_strings():
    """Verify imports inside comments, string literals, and template literals MUST NOT count."""
    files_data = {
        "src/file.ts": """
import { real } from "./real";
// import fake1 from "./fake1";
/*
import fake2 from "./fake2";
export { fake3 } from "./fake3";
*/
const str = "import fake4 from './fake4'";
const tmpl = `import fake5 from './fake5'`;
const dynExpr = import("./fake_" + num);
const dynVar = import(someVar);
const reqVar = require(someVar);
const realReq = require("./real_req");
const realDyn = import("./real_dyn");
""",
        "src/real.ts": "export const real = 1;",
        "src/real_req.ts": "export const req = 2;",
        "src/real_dyn.ts": "export const dyn = 3;",
    }
    file_index = [(k, "typescript") for k in files_data.keys()]
    reader = lambda p: files_data[p]

    resolver = JavaScriptResolver()
    evidences, unparseable = resolver.resolve(file_index, reader)

    assert unparseable == []
    specifiers = [e.specifier for e in evidences if e.source_file == "src/file.ts"]

    # Only real imports must be captured
    assert "./real" in specifiers
    assert "./real_req" in specifiers
    assert "./real_dyn" in specifiers

    # None of the fakes must be present
    for fake in ("./fake1", "./fake2", "./fake3", "./fake4", "./fake5"):
        assert fake not in specifiers


def test_javascript_resolver_tsconfig_paths_wildcards():
    """Verify tsconfig paths wildcard matching like @/* -> src/*."""
    files_data = {
        "tsconfig.json": '{\n  "compilerOptions": {\n    "baseUrl": ".",\n    "paths": {\n      "@/*": ["src/*"]\n    }\n  }\n}',
        "src/App.tsx": 'import { Card } from "@/components/Card";',
        "src/components/Card.tsx": 'export const Card = () => null;',
    }
    file_index = [(k, "json" if k.endswith(".json") else "tsx") for k in files_data.keys()]
    reader = lambda p: files_data[p]

    resolver = JavaScriptResolver()
    evidences, unparseable = resolver.resolve(file_index, reader)

    assert unparseable == []
    ev = next(e for e in evidences if e.source_file == "src/App.tsx")
    assert ev.specifier == "@/components/Card"
    assert ev.kind == "internal"
    assert ev.target_file == "src/components/Card.tsx"


def test_javascript_resolver_monorepo_workspaces():
    """Verify package.json workspaces resolution for cross-package dependencies."""
    files_data = {
        "package.json": '{"name": "root", "workspaces": ["packages/*"]}',
        "packages/shared/package.json": '{"name": "@mono/shared", "main": "src/index.ts"}',
        "packages/shared/src/index.ts": 'export const sharedVal = 100;',
        "packages/app/package.json": '{"name": "@mono/app", "main": "src/index.ts"}',
        "packages/app/src/index.ts": 'import { sharedVal } from "@mono/shared";',
    }
    file_index = [
        (k, "json" if k.endswith(".json") else "typescript")
        for k in files_data.keys()
    ]
    reader = lambda p: files_data[p]

    resolver = JavaScriptResolver()
    evidences, unparseable = resolver.resolve(file_index, reader)

    assert unparseable == []
    ev = next(e for e in evidences if e.source_file == "packages/app/src/index.ts")
    assert ev.specifier == "@mono/shared"
    assert ev.kind == "internal"
    assert ev.target_file == "packages/shared/src/index.ts"


def test_javascript_resolver_on_fixtures_disk():
    """Verify JS resolver on real disk fixture ts_app."""
    fixture_dir = Path("server/tests/fixtures/architecture/ts_app").resolve()
    assert fixture_dir.is_dir()

    reader = create_repo_reader(fixture_dir)
    files = [
        ("tsconfig.json", "json"),
        ("src/index.ts", "typescript"),
        ("src/legacy.ts", "typescript"),
        ("src/components/button/index.ts", "typescript"),
        ("src/components/button/Button.tsx", "tsx"),
        ("src/comments_and_strings.ts", "typescript"),
    ]

    resolver = JavaScriptResolver()
    evidences, unparseable = resolver.resolve(files, reader)

    assert unparseable == []

    # Check src/index.ts imports
    index_evs = [e for e in evidences if e.source_file == "src/index.ts"]
    react_ev = next(e for e in index_evs if e.specifier == "react")
    assert react_ev.kind == "external"

    btn_ev = next(e for e in index_evs if e.specifier == "@/components/button")
    assert btn_ev.kind == "internal"
    assert btn_ev.target_file == "src/components/button/index.ts"

    legacy_ev = next(e for e in index_evs if e.specifier == "./legacy.js")
    assert legacy_ev.kind == "internal"
    assert legacy_ev.target_file == "src/legacy.ts"

