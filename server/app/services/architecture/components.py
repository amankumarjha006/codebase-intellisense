"""Deterministic component grouping for repository architecture."""

from collections import defaultdict
import posixpath
import re
from typing import Sequence

from .schemas import ComponentOut

MIN_TARGET_COMPONENTS = 8
MAX_TARGET_COMPONENTS = 20
HARD_CAP_COMPONENTS = 40


def build_component_id(path_prefix: str) -> str:
    """Generate a deterministic, clean component ID."""
    if not path_prefix:
        return "comp_root"
    slug = re.sub(r"[^a-zA-Z0-9_]+", "_", path_prefix).strip("_").lower()
    return f"comp_{slug}"


def group_files_into_components(
    files: Sequence[tuple[str, str, int]],  # (file_path, language, size_bytes)
    min_components: int = MIN_TARGET_COMPONENTS,
    max_components: int = MAX_TARGET_COMPONENTS,
    hard_cap: int = HARD_CAP_COMPONENTS,
) -> tuple[list[ComponentOut], dict[str, str]]:
    """Deterministically collapse files into components (8-20, hard cap 40) by directory.

    Input order does not affect the output.
    Returns (components_list, file_to_component_id_map).
    """
    if not files:
        return [], {}

    # Sort files by path for strict determinism
    sorted_files = sorted(files, key=lambda f: f[0].replace("\\", "/"))

    # Try depths 2, 3, 1, 4 to find the best grouping within target range
    best_groups: dict[str, list[tuple[str, str, int]]] | None = None
    best_score = float("inf")

    for depth in (2, 3, 1, 4):
        groups: dict[str, list[tuple[str, str, int]]] = defaultdict(list)
        for path, lang, size in sorted_files:
            norm_path = path.replace("\\", "/")
            parts = norm_path.split("/")
            if len(parts) <= 1:
                prefix = ""
            else:
                dir_parts = parts[:-1]
                prefix = "/".join(dir_parts[:depth])
            groups[prefix].append((norm_path, lang, size))

        # Merge tiny groups if over max_components
        current_groups = dict(groups)
        while len(current_groups) > max_components:
            mergeable = [k for k in current_groups if "/" in k]
            if not mergeable:
                break
            # Sort by file count ascending, then depth descending, then name
            mergeable.sort(key=lambda k: (len(current_groups[k]), -len(k.split("/")), k))
            target_k = mergeable[0]
            parent_k = posixpath.dirname(target_k)
            merged_list = current_groups.pop(target_k)
            current_groups.setdefault(parent_k, []).extend(merged_list)

        count = len(current_groups)
        if min_components <= count <= max_components:
            best_groups = current_groups
            break

        score = abs(count - 14)  # Distance to sweet spot (14)
        if score < best_score:
            best_score = score
            best_groups = current_groups

    if best_groups is None:
        best_groups = {}

    # Hard cap enforcement (never exceed 40)
    while len(best_groups) > hard_cap:
        mergeable = [k for k in best_groups if "/" in k]
        if not mergeable:
            break
        mergeable.sort(key=lambda k: (len(best_groups[k]), -len(k.split("/")), k))
        target_k = mergeable[0]
        parent_k = posixpath.dirname(target_k)
        merged_list = best_groups.pop(target_k)
        best_groups.setdefault(parent_k, []).extend(merged_list)

    # Build ComponentOut objects and file_to_component mapping
    components: list[ComponentOut] = []
    file_to_component: dict[str, str] = {}

    # Sort component prefixes deterministically
    sorted_prefixes = sorted(best_groups.keys(), key=lambda p: (len(p.split("/")), p))

    # Avoid ID collisions
    used_ids: set[str] = set()

    for prefix in sorted_prefixes:
        c_files = best_groups[prefix]
        base_id = build_component_id(prefix)
        comp_id = base_id
        counter = 2
        while comp_id in used_ids:
            comp_id = f"{base_id}_{counter}"
            counter += 1
        used_ids.add(comp_id)

        # Compute language mix
        lang_counts: dict[str, int] = defaultdict(int)
        for f_path, lang, _ in c_files:
            lang_counts[lang] += 1
            file_to_component[f_path] = comp_id

        # Deterministically sort language mix: count descending, then lang name
        sorted_lang_mix = dict(
            sorted(lang_counts.items(), key=lambda item: (-item[1], item[0]))
        )

        display_name = prefix if prefix else "root"

        components.append(
            ComponentOut(
                id=comp_id,
                name=display_name,
                path_prefix=prefix,
                file_count=len(c_files),
                language_mix=sorted_lang_mix,
                layer=0,
                summary=None,
            )
        )

    # Sort final components list by name
    components.sort(key=lambda c: c.name)
    return components, file_to_component

