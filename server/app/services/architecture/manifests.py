"""System map extractor from repository deployment and packaging manifests."""

import json
import posixpath
import re
from typing import Any, Callable, Sequence
import yaml

from .schemas import SystemEdge, SystemMapOut, SystemNode

MAX_MANIFEST_FILES = 20
MAX_MANIFEST_SIZE_BYTES = 262_144  # 256 KB per manifest

# Fixed filename allowlist
MANIFEST_FILENAMES = (
    "Dockerfile",
    "Dockerfile.dev",
    "Dockerfile.prod",
    "docker-compose.yml",
    "docker-compose.yaml",
    "docker-compose.dev.yml",
    "docker-compose.dev.yaml",
    "docker-compose.prod.yml",
    "docker-compose.prod.yaml",
    "compose.yml",
    "compose.yaml",
    ".env.example",
    ".env.sample",
    ".env.template",
    "package.json",
    "pyproject.toml",
    "requirements.txt",
    "requirements-dev.txt",
)

ENTRYPOINT_FILENAMES = {
    "main.py",
    "app.py",
    "manage.py",
    "server.py",
    "server.ts",
    "server.js",
    "index.ts",
    "index.js",
    "worker.py",
}


def build_system_map(
    files: Sequence[tuple[str, str]],  # (file_path, language)
    read_file: Callable[[str], str],
) -> SystemMapOut:
    """Generate System Map from repository manifests and detected entry points."""
    nodes: list[SystemNode] = []
    edges: list[SystemEdge] = []

    # Filter allowlisted manifests
    manifest_files: list[str] = []
    entrypoint_files: list[str] = []

    for rel_path, _ in files:
        norm = rel_path.replace("\\", "/")
        basename = posixpath.basename(norm)
        if basename in MANIFEST_FILENAMES or any(
            basename.startswith(prefix)
            for prefix in ("Dockerfile.", "docker-compose.", "compose.", "requirements")
        ):
            if len(manifest_files) < MAX_MANIFEST_FILES:
                manifest_files.append(norm)

        if basename in ENTRYPOINT_FILENAMES and len(norm.split("/")) <= 4:
            if len(entrypoint_files) < 8:
                entrypoint_files.append(norm)

    all_external_deps: set[str] = set()
    primary_dep_file = ""
    service_ids: list[str] = []

    # 1. Parse Docker Compose files
    for m_path in manifest_files:
        base = posixpath.basename(m_path)
        if "compose" in base and (base.endswith(".yml") or base.endswith(".yaml")):
            try:
                content = read_file(m_path)
                data = yaml.safe_load(content)
                if isinstance(data, dict) and "services" in data and isinstance(data["services"], dict):
                    lines = content.splitlines()
                    for s_name, s_cfg in data["services"].items():
                        s_name_str = str(s_name)[:120]
                        s_id = f"sys_service_{re.sub(r'[^a-zA-Z0-9_]+', '_', s_name_str).lower()}"
                        service_ids.append(s_id)

                        # Find line number of service
                        line_no = 1
                        for idx, l in enumerate(lines, start=1):
                            if re.match(rf"^\s*{re.escape(s_name_str)}\s*:", l):
                                line_no = idx
                                break

                        meta: dict[str, Any] = {}
                        if isinstance(s_cfg, dict):
                            if "image" in s_cfg:
                                meta["image"] = str(s_cfg["image"])[:120]
                            if "ports" in s_cfg and isinstance(s_cfg["ports"], list):
                                meta["ports"] = [str(p)[:40] for p in s_cfg["ports"][:10]]
                            if "depends_on" in s_cfg:
                                deps = s_cfg["depends_on"]
                                dep_list = list(deps.keys()) if isinstance(deps, dict) else (deps if isinstance(deps, list) else [])
                                for dep in dep_list:
                                    dep_str = str(dep)[:120]
                                    target_id = f"sys_service_{re.sub(r'[^a-zA-Z0-9_]+', '_', dep_str).lower()}"
                                    edges.append(
                                        SystemEdge(
                                            source=s_id,
                                            target=target_id,
                                            label="depends_on",
                                        )
                                    )

                        nodes.append(
                            SystemNode(
                                id=s_id,
                                name=f"Service: {s_name_str}",
                                kind="service",
                                metadata=meta,
                                source_file=m_path,
                                line_number=line_no,
                            )
                        )
            except Exception:
                continue

    # 2. Parse Dockerfile
    for m_path in manifest_files:
        base = posixpath.basename(m_path)
        if base == "Dockerfile" or base.startswith("Dockerfile."):
            try:
                content = read_file(m_path)
                lines = content.splitlines()
                base_image = "unknown"
                cmd_str = ""
                from_line = 1
                for idx, l in enumerate(lines, start=1):
                    stripped = l.strip()
                    if stripped.upper().startswith("FROM "):
                        base_image = stripped[5:].split()[0][:120]
                        from_line = idx
                    elif stripped.upper().startswith("CMD ") or stripped.upper().startswith("ENTRYPOINT "):
                        cmd_str = stripped[:240]

                slug = re.sub(r"[^a-zA-Z0-9_]+", "_", m_path).lower()
                c_id = f"sys_container_{slug}"
                service_ids.append(c_id)
                nodes.append(
                    SystemNode(
                        id=c_id,
                        name=f"Container ({base})"[:120],
                        kind="container",
                        metadata={"base_image": base_image, "cmd": cmd_str},
                        source_file=m_path,
                        line_number=from_line,
                    )
                )
            except Exception:
                continue

    # 3. Parse .env.example / .env.sample (KEY NAMES ONLY - DISCARD VALUES IMMEDIATELY)
    for m_path in manifest_files:
        base = posixpath.basename(m_path)
        if base.startswith(".env."):
            try:
                content = read_file(m_path)
                lines = content.splitlines()
                key_names: list[str] = []
                for l in lines:
                    stripped = l.strip()
                    if not stripped or stripped.startswith("#"):
                        continue
                    if "=" in stripped:
                        key = stripped.split("=")[0].strip()
                        # Strict key validation: alphanumeric + underscores only
                        if key and re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", key):
                            key_names.append(key[:120])

                if key_names:
                    slug = re.sub(r"[^a-zA-Z0-9_]+", "_", m_path).lower()
                    nodes.append(
                        SystemNode(
                            id=f"sys_config_{slug}",
                            name=f"Config: {base} ({len(key_names)} vars)"[:120],
                            kind="config",
                            metadata={"keys": key_names[:50]},
                            source_file=m_path,
                            line_number=1,
                        )
                    )
            except Exception:
                continue

    # 4. Parse Package Manifests for Dependencies
    for m_path in manifest_files:
        base = posixpath.basename(m_path)
        if base == "package.json":
            try:
                content = read_file(m_path)
                data = json.loads(content)
                deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
                for d in deps.keys():
                    all_external_deps.add(str(d)[:120])
                if not primary_dep_file:
                    primary_dep_file = m_path
            except Exception:
                continue

        elif base == "pyproject.toml":
            try:
                import tomllib

                content = read_file(m_path)
                data = tomllib.loads(content)
                proj_deps = data.get("project", {}).get("dependencies", [])
                for d in proj_deps:
                    pkg = str(d).split()[0].split(";")[0].split("=")[0].split(">")[0].split("<")[0]
                    all_external_deps.add(pkg[:120])
                if not primary_dep_file:
                    primary_dep_file = m_path
            except Exception:
                continue

        elif base.startswith("requirements") and base.endswith(".txt"):
            try:
                content = read_file(m_path)
                for l in content.splitlines():
                    stripped = l.strip()
                    if not stripped or stripped.startswith("#"):
                        continue
                    pkg = stripped.split()[0].split("==")[0].split(">=")[0].split("<=")[0].split(";")[0]
                    if pkg and re.match(r"^[A-Za-z0-9_\-\.]+$", pkg):
                        all_external_deps.add(pkg[:120])
                if not primary_dep_file:
                    primary_dep_file = m_path
            except Exception:
                continue

    # 5. External dependencies node (collapsed into one node)
    if all_external_deps:
        ext_node_id = "sys_external_deps"
        sorted_samples = sorted(list(all_external_deps))[:20]
        nodes.append(
            SystemNode(
                id=ext_node_id,
                name=f"External dependencies ({len(all_external_deps)})"[:120],
                kind="external_deps",
                metadata={
                    "count": len(all_external_deps),
                    "samples": sorted_samples,
                },
                source_file=primary_dep_file or manifest_files[0],
                line_number=1,
            )
        )
        # Connect services/containers to external dependencies node
        for s_id in service_ids:
            edges.append(
                SystemEdge(
                    source=s_id,
                    target=ext_node_id,
                    label="uses",
                )
            )

    # 6. Entrypoints
    for e_path in entrypoint_files:
        base = posixpath.basename(e_path)
        slug = re.sub(r"[^a-zA-Z0-9_]+", "_", e_path).lower()
        entry_id = f"sys_entry_{slug}"
        nodes.append(
            SystemNode(
                id=entry_id,
                name=f"Entrypoint: {base}"[:120],
                kind="runtime",
                metadata={"path": e_path},
                source_file=e_path,
                line_number=1,
            )
        )
        if all_external_deps:
            edges.append(
                SystemEdge(
                    source=entry_id,
                    target="sys_external_deps",
                    label="uses",
                )
            )

    return SystemMapOut(nodes=nodes, edges=edges)

