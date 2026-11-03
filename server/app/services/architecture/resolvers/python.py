"""Python AST-based import extractor and resolver."""

import ast
import os
import posixpath
import sys
import time
from typing import Callable, Sequence

from ..types import FileReader, ImportEvidence

MAX_FILES_ANALYZED = 20_000
DEFAULT_TIMEOUT_SECONDS = 60.0

# Standard library module names in Python
STDLIB_MODULES: frozenset[str] = frozenset(
    getattr(sys, "stdlib_module_names", set()) | set(sys.builtin_module_names)
)


class PythonResolver:
    """Pure AST-based import resolver for Python repositories."""

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

        # Filter python files and enforce cap
        py_files: list[str] = []
        for rel_path, lang in files:
            norm_path = rel_path.replace("\\", "/")
            if lang.lower() == "python" or norm_path.endswith(".py"):
                py_files.append(norm_path)

        if len(py_files) > MAX_FILES_ANALYZED:
            py_files = py_files[:MAX_FILES_ANALYZED]

        all_py_files_set = set(py_files)

        # Detect candidate source roots and top-level directory names
        source_roots = self._detect_source_roots(py_files)
        repo_top_levels = self._collect_repo_top_levels(py_files)

        for source_file in py_files:
            if clock_fn() - start_time > timeout_seconds:
                # Timeout budget reached
                break

            try:
                content = read_file(source_file)
            except Exception:
                unparseable_files.append(source_file)
                continue

            try:
                tree = ast.parse(content, filename=source_file)
            except (SyntaxError, ValueError, RecursionError):
                unparseable_files.append(source_file)
                continue
            except Exception:
                unparseable_files.append(source_file)
                continue

            file_evidences = self._extract_and_resolve_file_imports(
                source_file=source_file,
                tree=tree,
                all_py_files=all_py_files_set,
                source_roots=source_roots,
                repo_top_levels=repo_top_levels,
            )
            evidences.extend(file_evidences)

        return evidences, unparseable_files

    def _detect_source_roots(self, py_files: list[str]) -> list[str]:
        """Detect candidate source roots (e.g. '', 'src', 'server', 'backend')."""
        roots: list[str] = [""]
        common_candidates = ("src", "server", "backend", "lib", "app")
        for cand in common_candidates:
            cand_prefix = f"{cand}/"
            if any(p.startswith(cand_prefix) for p in py_files):
                if cand not in roots:
                    roots.append(cand)

        # Also find any directory containing an __init__.py at top 2 levels
        for p in py_files:
            parts = p.split("/")
            if len(parts) >= 2 and parts[-1] == "__init__.py":
                parent = "/".join(parts[:-2])
                if parent and parent not in roots and len(parts) <= 4:
                    roots.append(parent)

        return sorted(roots, key=lambda r: (-len(r), r))

    def _collect_repo_top_levels(self, py_files: list[str]) -> set[str]:
        """Collect top-level package and directory names present in the repo."""
        top_levels: set[str] = set()
        for p in py_files:
            parts = p.split("/")
            top_levels.add(parts[0])
            if len(parts) > 1 and parts[0] in ("src", "server", "backend", "lib"):
                top_levels.add(parts[1])
        return top_levels

    def _extract_and_resolve_file_imports(
        self,
        source_file: str,
        tree: ast.AST,
        all_py_files: set[str],
        source_roots: list[str],
        repo_top_levels: set[str],
    ) -> list[ImportEvidence]:
        evidences: list[ImportEvidence] = []
        source_dir = posixpath.dirname(source_file)

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    specifier = alias.name
                    target, kind = self._resolve_absolute_import(
                        specifier=specifier,
                        all_py_files=all_py_files,
                        source_roots=source_roots,
                        repo_top_levels=repo_top_levels,
                    )
                    evidences.append(
                        ImportEvidence(
                            source_file=source_file,
                            target_file=target,
                            specifier=specifier,
                            line_number=node.lineno,
                            kind=kind,
                            symbol=alias.asname or alias.name,
                        )
                    )

            elif isinstance(node, ast.ImportFrom):
                level = node.level or 0
                module = node.module or ""
                for alias in node.names:
                    symbol_name = alias.name
                    if level > 0:
                        # Relative import
                        raw_spec = "." * level + module
                        if symbol_name and symbol_name != "*":
                            full_spec = f"{raw_spec}.{symbol_name}" if module else f"{raw_spec}{symbol_name}"
                        else:
                            full_spec = raw_spec

                        target, kind = self._resolve_relative_import(
                            source_dir=source_dir,
                            level=level,
                            module=module,
                            symbol_name=symbol_name,
                            all_py_files=all_py_files,
                        )
                    else:
                        # Absolute import
                        full_spec = f"{module}.{symbol_name}" if symbol_name != "*" else module
                        target, kind = self._resolve_from_import(
                            module=module,
                            symbol_name=symbol_name,
                            all_py_files=all_py_files,
                            source_roots=source_roots,
                            repo_top_levels=repo_top_levels,
                        )

                    evidences.append(
                        ImportEvidence(
                            source_file=source_file,
                            target_file=target,
                            specifier=full_spec,
                            line_number=node.lineno,
                            kind=kind,
                            symbol=symbol_name,
                        )
                    )

        return evidences

    def _resolve_relative_import(
        self,
        source_dir: str,
        level: int,
        module: str,
        symbol_name: str,
        all_py_files: set[str],
    ) -> tuple[str | None, str]:
        """Resolve a relative import (level >= 1)."""
        # Determine base directory: level 1 is source_dir, level 2 is parent, etc.
        parts = source_dir.split("/") if source_dir else []
        steps_up = level - 1
        if steps_up > len(parts):
            # Escapes repository root
            return None, "unresolved"

        base_parts = parts[: len(parts) - steps_up] if steps_up > 0 else parts
        base_dir = "/".join(base_parts)

        if module:
            subpath = module.replace(".", "/")
            target_prefix = posixpath.normpath(posixpath.join(base_dir, subpath)) if base_dir else subpath
        else:
            target_prefix = base_dir

        if target_prefix.startswith("../") or target_prefix == "..":
            return None, "unresolved"

        # Try 1: submodule/subfile target_prefix/symbol_name
        if symbol_name and symbol_name != "*":
            cand_submodule = posixpath.join(target_prefix, symbol_name) if target_prefix else symbol_name
            matched = self._find_module_file(cand_submodule, all_py_files)
            if matched:
                return matched, "internal"

        # Try 2: module target_prefix itself (symbol_name is an attribute in target_prefix)
        matched_prefix = self._find_module_file(target_prefix, all_py_files)
        if matched_prefix:
            return matched_prefix, "internal"

        # Try 3: If target_prefix has no __init__.py but has python files (namespace package)
        # Check if symbol_name is a module inside it
        if symbol_name and symbol_name != "*":
            cand_file = f"{target_prefix}/{symbol_name}.py" if target_prefix else f"{symbol_name}.py"
            if cand_file in all_py_files:
                return cand_file, "internal"

        return None, "unresolved"

    def _resolve_from_import(
        self,
        module: str,
        symbol_name: str,
        all_py_files: set[str],
        source_roots: list[str],
        repo_top_levels: set[str],
    ) -> tuple[str | None, str]:
        """Resolve 'from pkg import name' with rule: try pkg.name module, then pkg."""
        top_pkg = module.split(".")[0] if module else ""
        if top_pkg in STDLIB_MODULES:
            return None, "external"

        # Try 1: check if pkg.name is a submodule
        if symbol_name and symbol_name != "*":
            combined_mod = f"{module}.{symbol_name}" if module else symbol_name
            target, kind = self._resolve_module_path(combined_mod, all_py_files, source_roots)
            if target and kind == "internal":
                return target, "internal"
            if kind == "unresolved":  # ambiguous
                return None, "unresolved"

        # Try 2: check if module itself is a file or package
        target, kind = self._resolve_module_path(module, all_py_files, source_roots)
        if target and kind == "internal":
            return target, "internal"
        if kind == "unresolved":  # ambiguous
            return None, "unresolved"

        # Suffix matching fallback
        suffix_matches = self._match_longest_suffix(module, symbol_name, all_py_files)
        if len(suffix_matches) == 1:
            return suffix_matches[0], "internal"
        elif len(suffix_matches) > 1:
            return None, "unresolved"

        # If top-level package is known in repo, it's an internal unresolved import
        if top_pkg in repo_top_levels:
            return None, "unresolved"

        # Otherwise it's external third-party
        return None, "external"

    def _resolve_absolute_import(
        self,
        specifier: str,
        all_py_files: set[str],
        source_roots: list[str],
        repo_top_levels: set[str],
    ) -> tuple[str | None, str]:
        """Resolve 'import foo' or 'import foo.bar'."""
        top_pkg = specifier.split(".")[0]
        if top_pkg in STDLIB_MODULES:
            return None, "external"

        target, kind = self._resolve_module_path(specifier, all_py_files, source_roots)
        if target and kind == "internal":
            return target, "internal"
        if kind == "unresolved":  # ambiguous
            return None, "unresolved"

        # Try suffix matching
        suffix_matches = self._match_longest_suffix(specifier, None, all_py_files)
        if len(suffix_matches) == 1:
            return suffix_matches[0], "internal"
        elif len(suffix_matches) > 1:
            return None, "unresolved"

        # If specifier matches a top-level folder in the repo, mark unresolved
        if top_pkg in repo_top_levels:
            return None, "unresolved"

        return None, "external"

    def _resolve_module_path(
        self,
        module_path: str,
        all_py_files: set[str],
        source_roots: list[str],
    ) -> tuple[str | None, str]:
        """Test module path against source roots."""
        rel_subpath = module_path.replace(".", "/")
        matches: list[str] = []

        for root in source_roots:
            cand_prefix = f"{root}/{rel_subpath}" if root else rel_subpath
            file_match = self._find_module_file(cand_prefix, all_py_files)
            if file_match and file_match not in matches:
                matches.append(file_match)

        if len(matches) == 1:
            return matches[0], "internal"
        elif len(matches) > 1:
            # Ambiguous match -> unresolved
            return None, "unresolved"

        return None, "not_found"

    def _find_module_file(self, mod_prefix: str, all_py_files: set[str]) -> str | None:
        """Check for mod_prefix.py or mod_prefix/__init__.py."""
        norm = posixpath.normpath(mod_prefix)
        file_cand = f"{norm}.py"
        if file_cand in all_py_files:
            return file_cand

        init_cand = f"{norm}/__init__.py"
        if init_cand in all_py_files:
            return init_cand

        return None

    def _match_longest_suffix(
        self,
        module: str,
        symbol_name: str | None,
        all_py_files: set[str],
    ) -> list[str]:
        """Find matching files by longest unique suffix."""
        if not module:
            return []

        rel_subpath = module.replace(".", "/")
        patterns: list[str] = []

        if symbol_name and symbol_name != "*":
            combined = f"{rel_subpath}/{symbol_name}"
            patterns.append(f"{combined}.py")
            patterns.append(f"{combined}/__init__.py")

        patterns.append(f"{rel_subpath}.py")
        patterns.append(f"{rel_subpath}/__init__.py")

        for pattern in patterns:
            pattern_suffix = f"/{pattern}"
            matches = [
                f
                for f in all_py_files
                if f == pattern or f.endswith(pattern_suffix)
            ]
            if matches:
                return matches

        return []

