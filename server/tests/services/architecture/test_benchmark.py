"""Benchmark test verifying 5,000-file repository analysis runs under 30s CPU."""

import time
from app.services.architecture.components import group_files_into_components
from app.services.architecture.flows import trace_data_flows
from app.services.architecture.graph import build_architecture_graph
from app.services.architecture.manifests import build_system_map
from app.services.architecture.runner import analyze_repository_imports


def test_5000_file_repo_performance():
    """Target: a 5,000-file repo analyzes in under 30 s of CPU."""
    synthetic_files = []
    synthetic_content = {}

    for pkg_idx in range(25):
        pkg_name = f"pkg_{pkg_idx}"
        for file_idx in range(200):
            rel_path = f"packages/{pkg_name}/src/module_{file_idx}.py"
            target_pkg = f"pkg_{(pkg_idx + 1) % 25}"
            content = (
                f"import sys\nimport os\n"
                f"from packages.{target_pkg}.src.module_0 import helper\n"
                f"def run(): return helper()\n"
            )
            synthetic_files.append((rel_path, "python", len(content)))
            synthetic_content[rel_path] = content

    synthetic_files.append(("package.json", "json", 100))
    synthetic_content["package.json"] = '{"name": "root", "workspaces": ["packages/*"]}'

    synthetic_files.append(("docker-compose.yml", "yaml", 150))
    synthetic_content["docker-compose.yml"] = (
        "services:\n"
        "  web:\n"
        "    image: nginx:alpine\n"
        "    depends_on:\n"
        "      - api\n"
        "  api:\n"
        "    image: app:latest\n"
    )

    reader = lambda p: synthetic_content[p]
    file_index = [(f[0], f[1]) for f in synthetic_files]

    cpu_start = time.process_time()

    # 1. Resolvers
    cov, evidences = analyze_repository_imports(files=file_index, read_file=reader)

    # 2. Components
    comps, file_map = group_files_into_components(synthetic_files)

    # 3. Graph
    edges, truncated = build_architecture_graph(comps, file_map, evidences)

    # 4. Manifests
    sys_map = build_system_map(file_index, reader)

    # 5. Flows
    flows = trace_data_flows(file_index, reader, comps, file_map, edges)

    cpu_elapsed = time.process_time() - cpu_start

    assert cpu_elapsed < 30.0, f"CPU time exceeded 30s target: {cpu_elapsed}s"
    assert len(comps) <= 40
    assert len(synthetic_files) >= 5000

