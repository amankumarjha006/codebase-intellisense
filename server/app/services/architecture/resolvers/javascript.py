"""Tree-sitter based JavaScript/TypeScript import extractor and resolver."""

import json
import posixpath
import re
import time
from typing import Any, Callable, Sequence

from ..types import FileReader, ImportEvidence

MAX_FILES_ANALYZED = 20_000
DEFAULT_TIMEOUT_SECONDS = 60.0

try:
    import tree_sitter_javascript
    import tree_sitter_typescript
    from tree_sitter import Language, Parser
    TREE_SITTER_AVAILABLE = True
except ImportError:
    Language = None
    Parser = None
    TREE_SITTER_AVAILABLE = False


def clean_jsonc(text: str) -> str:
    """Strip single-line comments, block comments, and trailing commas from JSONC."""
    out: list[str] = []
    i = 0
    n = len(text)
    in_string = False
    quote_char = ""
    while i < n:
        c = text[i]
        if in_string:
            out.append(c)
            if c == "\\":
                if i + 1 < n:
                    i += 1
                    out.append(text[i])
            elif c == quote_char:
                in_string = False
        else:
            if c in ('"', "'"):
                in_string = True
                quote_char = c
                out.append(c)
            elif c == "/" and i + 1 < n and text[i + 1] == "/":
                i += 2
                while i < n and text[i] not in ("\r", "\n"):
                    i += 1
                continue
            elif c == "/" and i + 1 < n and text[i + 1] == "*":
                i += 2
                while i + 1 < n and not (text[i] == "*" and text[i + 1] == "/"):
                    i += 1
                i += 2
                continue
            else:
                out.append(c)
        i += 1
    cleaned = "".join(out)
    return re.sub(r",\s*([}\]])", r"\1", cleaned)


class JavaScriptResolver:
    """Pure Tree-sitter import resolver for JavaScript, TypeScript, JSX, and TSX."""

    JS_EXTENSIONS = (
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".d.ts",
        ".json",
        ".mjs",
        ".cjs",
    )

    def __init__(self) -> None:
        if not TREE_SITTER_AVAILABLE:
            self._js_parser = None
            self._ts_parser = None
            self._tsx_parser = None
            return

        self._js_parser = Parser(Language(tree_sitter_javascript.language()))
        self._ts_parser = Parser(Language(tree_sitter_typescript.language_typescript()))
        self._tsx_parser = Parser(Language(tree_sitter_typescript.language_tsx()))

    def resolve(
        self,
        files: Sequence[tuple[str, str]],
        read_file: FileReader,
        clock: Callable[[], float] | None = None,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    ) -> tuple[list[ImportEvidence], list[str]]:
        clock_fn = clock or time.monotonic
        start_time = clock_fn()

        evidences: list[ImportEvidence] = []
        unparseable_files: list[str] = []

        # Filter JS/TS files and build index
        target_files: list[str] = []
        all_files_set: set[str] = set()

        for rel_path, lang in files:
            norm_path = rel_path.replace("\\", "/")
            all_files_set.add(norm_path)
            lang_lower = lang.lower()
            if (
                lang_lower in ("javascript", "typescript", "jsx", "tsx")
                or norm_path.endswith((".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"))
            ):
                target_files.append(norm_path)

        if len(target_files) > MAX_FILES_ANALYZED:
            target_files = target_files[:MAX_FILES_ANALYZED]

        # Load workspace packages from package.json files
        workspaces = self._load_workspaces(all_files_set, read_file)

        # Cache tsconfig configurations by directory
        tsconfig_cache: dict[str, dict[str, Any]] = {}

        for source_file in target_files:
            if clock_fn() - start_time > timeout_seconds:
                break

            try:
                content = read_file(source_file)
            except Exception:
                unparseable_files.append(source_file)
                continue

            raw_imports, unparseable = self._extract_raw_imports(source_file, content)
            if unparseable:
                unparseable_files.append(source_file)
                continue

            ts_config = self._find_and_load_tsconfig(source_file, all_files_set, read_file, tsconfig_cache)

            for specifier, line_no in raw_imports:
                target, kind = self._resolve_specifier(
                    source_file=source_file,
                    specifier=specifier,
                    all_files=all_files_set,
                    tsconfig=ts_config,
                    workspaces=workspaces,
                )
                evidences.append(
                    ImportEvidence(
                        source_file=source_file,
                        target_file=target,
                        specifier=specifier,
                        line_number=line_no,
                        kind=kind,
                    )
                )

        return evidences, unparseable_files

    def _extract_raw_imports(self, source_file: str, content: str) -> tuple[list[tuple[str, int]], bool]:
        """Extract (specifier, line) using Tree-sitter. Ignores comments and strings."""
        if not TREE_SITTER_AVAILABLE:
            return [], True

        source_bytes = content.encode("utf-8", "ignore")
        if source_file.endswith(".tsx"):
            parser = self._tsx_parser
        elif source_file.endswith((".ts", ".d.ts")):
            parser = self._ts_parser
        elif source_file.endswith(".jsx"):
            parser = self._tsx_parser or self._js_parser
        else:
            parser = self._js_parser

        if parser is None:
            return [], True

        try:
            tree = parser.parse(source_bytes)
        except Exception:
            return [], True

        raw_imports: list[tuple[str, int]] = []

        def get_text(node: Any) -> str:
            return source_bytes[node.start_byte : node.end_byte].decode("utf-8", "ignore")

        def clean_str(node: Any) -> str:
            text = get_text(node)
            if len(text) >= 2 and text[0] in ('"', "'", "`") and text[-1] == text[0]:
                return text[1:-1]
            return text

        def walk(node: Any) -> None:
            # Skip comments, string literals, and template strings
            if node.type in ("comment", "string", "template_string"):
                return

            if node.type in ("import_statement", "export_statement"):
                src_node = node.child_by_field_name("source")
                if src_node and src_node.type == "string":
                    spec = clean_str(src_node)
                    if spec:
                        raw_imports.append((spec, node.start_point[0] + 1))

            elif node.type == "call_expression":
                fn = node.child_by_field_name("function")
                args = node.child_by_field_name("arguments")
                if fn and args and args.named_children:
                    first_arg = args.named_children[0]
                    # Dynamic import or require must use a string literal
                    if first_arg.type == "string":
                        fn_type = fn.type
                        fn_text = get_text(fn)
                        if fn_type == "identifier" and fn_text == "require":
                            spec = clean_str(first_arg)
                            if spec:
                                raw_imports.append((spec, node.start_point[0] + 1))
                        elif fn_type == "import" or (fn_type == "identifier" and fn_text == "import"):
                            spec = clean_str(first_arg)
                            if spec:
                                raw_imports.append((spec, node.start_point[0] + 1))
                        elif fn_type == "member_expression" and fn_text == "require.resolve":
                            spec = clean_str(first_arg)
                            if spec:
                                raw_imports.append((spec, node.start_point[0] + 1))

            for child in node.children:
                walk(child)

        walk(tree.root_node)
        return raw_imports, False

    def _resolve_specifier(
        self,
        source_file: str,
        specifier: str,
        all_files: set[str],
        tsconfig: dict[str, Any] | None,
        workspaces: dict[str, dict[str, str]],
    ) -> tuple[str | None, str]:
        """Resolve a JS/TS specifier to an internal target file or classify as external/unresolved."""
        source_dir = posixpath.dirname(source_file)

        # 1. Relative imports (starts with ./ or ../ or /)
        if specifier.startswith(("./", "../", "/")):
            target_base = posixpath.normpath(posixpath.join(source_dir, specifier))
            matched = self._probe_file_candidates(target_base, all_files)
            if len(matched) == 1:
                return matched[0], "internal"
            elif len(matched) > 1:
                return None, "unresolved"
            return None, "unresolved"

        # 2. tsconfig paths / baseUrl resolution
        if tsconfig:
            paths_match, is_paths_candidate = self._resolve_tsconfig_paths(specifier, tsconfig, all_files)
            if len(paths_match) == 1:
                return paths_match[0], "internal"
            elif len(paths_match) > 1:
                return None, "unresolved"
            elif is_paths_candidate:
                # Was an alias match in tsconfig paths, but failed to resolve to a file
                return None, "unresolved"

            # Check baseUrl resolution
            base_url = tsconfig.get("baseUrl")
            if base_url:
                base_cand = posixpath.normpath(posixpath.join(base_url, specifier))
                matched_base = self._probe_file_candidates(base_cand, all_files)
                if len(matched_base) == 1:
                    return matched_base[0], "internal"
                elif len(matched_base) > 1:
                    return None, "unresolved"

        # 3. Monorepo workspaces
        if workspaces:
            for pkg_name, pkg_info in workspaces.items():
                if specifier == pkg_name:
                    main_cand = pkg_info.get("main")
                    pkg_dir = pkg_info["dir"]
                    cand = posixpath.join(pkg_dir, main_cand) if main_cand else pkg_dir
                    matched = self._probe_file_candidates(cand, all_files)
                    if len(matched) == 1:
                        return matched[0], "internal"
                    elif len(matched) > 1:
                        return None, "unresolved"
                elif specifier.startswith(f"{pkg_name}/"):
                    subpath = specifier[len(pkg_name) + 1 :]
                    pkg_dir = pkg_info["dir"]
                    cand = posixpath.join(pkg_dir, subpath)
                    matched = self._probe_file_candidates(cand, all_files)
                    if len(matched) == 1:
                        return matched[0], "internal"
                    elif len(matched) > 1:
                        return None, "unresolved"

        # 4. Bare specifiers -> External library
        return None, "external"

    def _probe_file_candidates(self, base_path: str, all_files: set[str]) -> list[str]:
        """Probe exact file, TS .js -> .ts quirk, extension probing, and index files."""
        matches: list[str] = []

        # Exact match
        if base_path in all_files:
            matches.append(base_path)

        # TS moduleResolution quirk: .js/.jsx/.mjs/.cjs resolving to .ts/.tsx/.mts/.cts
        if base_path.endswith(".js"):
            no_ext = base_path[:-3]
            for ext in (".ts", ".tsx", ".d.ts"):
                cand = no_ext + ext
                if cand in all_files and cand not in matches:
                    matches.append(cand)
        elif base_path.endswith(".jsx"):
            no_ext = base_path[:-4]
            for ext in (".tsx", ".ts"):
                cand = no_ext + ext
                if cand in all_files and cand not in matches:
                    matches.append(cand)
        elif base_path.endswith(".mjs"):
            cand = base_path[:-4] + ".mts"
            if cand in all_files and cand not in matches:
                matches.append(cand)
        elif base_path.endswith(".cjs"):
            cand = base_path[:-4] + ".cts"
            if cand in all_files and cand not in matches:
                matches.append(cand)

        # Extension probing
        for ext in self.JS_EXTENSIONS:
            cand = base_path + ext
            if cand in all_files and cand not in matches:
                matches.append(cand)

        # Directory index files probing
        for ext in (".ts", ".tsx", ".js", ".jsx", ".d.ts"):
            cand = posixpath.join(base_path, f"index{ext}")
            if cand in all_files and cand not in matches:
                matches.append(cand)

        return matches

    def _resolve_tsconfig_paths(
        self,
        specifier: str,
        tsconfig: dict[str, Any],
        all_files: set[str],
    ) -> tuple[list[str], bool]:
        """Resolve tsconfig paths mappings with wildcards."""
        paths_map = tsconfig.get("paths", {})
        base_dir = tsconfig.get("baseUrl") or tsconfig.get("config_dir", "")
        matches: list[str] = []
        is_pattern_candidate = False

        for pattern, targets in paths_map.items():
            if "*" in pattern:
                prefix, suffix = pattern.split("*", 1)
                if specifier.startswith(prefix) and specifier.endswith(suffix):
                    is_pattern_candidate = True
                    matched_star = specifier[len(prefix) : len(specifier) - len(suffix)] if suffix else specifier[len(prefix) :]
                    for target in targets:
                        expanded = target.replace("*", matched_star)
                        resolved_target = posixpath.normpath(
                            posixpath.join(base_dir, expanded) if base_dir else expanded
                        )
                        file_matches = self._probe_file_candidates(resolved_target, all_files)
                        for fm in file_matches:
                            if fm not in matches:
                                matches.append(fm)
            else:
                if specifier == pattern:
                    is_pattern_candidate = True
                    for target in targets:
                        resolved_target = posixpath.normpath(
                            posixpath.join(base_dir, target) if base_dir else target
                        )
                        file_matches = self._probe_file_candidates(resolved_target, all_files)
                        for fm in file_matches:
                            if fm not in matches:
                                matches.append(fm)

        return matches, is_pattern_candidate

    def _find_and_load_tsconfig(
        self,
        source_file: str,
        all_files: set[str],
        read_file: FileReader,
        cache: dict[str, dict[str, Any]],
    ) -> dict[str, Any] | None:
        """Find the nearest tsconfig.json or jsconfig.json for a source file."""
        curr = posixpath.dirname(source_file)
        visited_dirs: list[str] = []

        while True:
            if curr in cache:
                cfg = cache[curr]
                for d in visited_dirs:
                    cache[d] = cfg
                return cfg

            visited_dirs.append(curr)

            # Check tsconfig.json then jsconfig.json in curr
            for name in ("tsconfig.json", "jsconfig.json"):
                cand = posixpath.join(curr, name) if curr else name
                if cand in all_files:
                    cfg = self._load_tsconfig_file(cand, all_files, read_file)
                    for d in visited_dirs:
                        cache[d] = cfg
                    return cfg

            if not curr:
                break
            parent = posixpath.dirname(curr)
            if parent == curr:
                break
            curr = parent

        # None found
        empty_cfg: dict[str, Any] = {}
        for d in visited_dirs:
            cache[d] = empty_cfg
        return None

    def _load_tsconfig_file(
        self,
        config_path: str,
        all_files: set[str],
        read_file: FileReader,
        seen: set[str] | None = None,
    ) -> dict[str, Any]:
        """Load and merge tsconfig JSON, handling extends and comments."""
        seen = seen or set()
        if config_path in seen:
            return {}
        seen.add(config_path)

        try:
            content = read_file(config_path)
            data = json.loads(clean_jsonc(content))
        except Exception:
            return {}

        config_dir = posixpath.dirname(config_path)
        compiler_options = data.get("compilerOptions", {})

        result: dict[str, Any] = {
            "config_dir": config_dir,
            "baseUrl": None,
            "paths": {},
        }

        # Handle extends
        extends_rel = data.get("extends")
        if extends_rel and isinstance(extends_rel, str):
            extends_path = posixpath.normpath(
                posixpath.join(config_dir, extends_rel) if config_dir else extends_rel
            )
            if not extends_path.endswith(".json"):
                extends_path += ".json"

            if extends_path in all_files:
                base_cfg = self._load_tsconfig_file(extends_path, all_files, read_file, seen)
                result["baseUrl"] = base_cfg.get("baseUrl")
                result["paths"] = dict(base_cfg.get("paths", {}))

        # Merge local options
        if "baseUrl" in compiler_options:
            raw_base = compiler_options["baseUrl"]
            result["baseUrl"] = posixpath.normpath(
                posixpath.join(config_dir, raw_base) if config_dir else raw_base
            )

        if "paths" in compiler_options and isinstance(compiler_options["paths"], dict):
            result["paths"].update(compiler_options["paths"])

        return result

    def _load_workspaces(
        self,
        all_files: set[str],
        read_file: FileReader,
    ) -> dict[str, dict[str, str]]:
        """Find all package.json files and map workspace package names to their directories."""
        workspaces: dict[str, dict[str, str]] = {}

        for file_path in all_files:
            if file_path == "package.json" or file_path.endswith("/package.json"):
                try:
                    content = read_file(file_path)
                    data = json.loads(clean_jsonc(content))
                    name = data.get("name")
                    if name and isinstance(name, str):
                        pkg_dir = posixpath.dirname(file_path)
                        main_entry = data.get("main") or data.get("module") or data.get("source")
                        workspaces[name] = {
                            "dir": pkg_dir,
                            "main": main_entry or "",
                        }
                except Exception:
                    continue

        return workspaces

