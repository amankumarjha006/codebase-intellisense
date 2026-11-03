"""Tests for System Map manifest extraction."""

from app.services.architecture.manifests import build_system_map


def test_manifests_docker_compose_and_dockerfile():
    files_data = {
        "docker-compose.yml": """
services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
    depends_on:
      - api
  api:
    image: myapi:latest
""",
        "Dockerfile": """
FROM python:3.11-slim
CMD ["uvicorn", "app.main:app"]
""",
    }
    file_index = [(k, "yaml" if k.endswith(".yml") else "dockerfile") for k in files_data.keys()]
    reader = lambda p: files_data[p]

    sys_map = build_system_map(file_index, reader)

    service_nodes = [n for n in sys_map.nodes if n.kind == "service"]
    assert len(service_nodes) == 2
    web_node = next(n for n in service_nodes if "web" in n.name)
    assert web_node.metadata["image"] == "nginx:alpine"
    assert "80:80" in web_node.metadata["ports"]

    container_nodes = [n for n in sys_map.nodes if n.kind == "container"]
    assert len(container_nodes) == 1
    assert container_nodes[0].metadata["base_image"] == "python:3.11-slim"

    # Edge between web and api
    edge = next(e for e in sys_map.edges if e.label == "depends_on")
    assert "web" in edge.source
    assert "api" in edge.target


def test_manifests_env_example_key_names_only():
    """Verify only variable names are kept and secrets/values are never stored."""
    files_data = {
        ".env.example": """
# Database credentials
DATABASE_URL=postgres://user:supersecretpass@localhost:5432/db
SECRET_KEY=1234567890abcdef
DEBUG=True
"""
    }
    file_index = [(k, "config") for k in files_data.keys()]
    reader = lambda p: files_data[p]

    sys_map = build_system_map(file_index, reader)

    config_nodes = [n for n in sys_map.nodes if n.kind == "config"]
    assert len(config_nodes) == 1
    node = config_nodes[0]
    keys = node.metadata["keys"]
    assert "DATABASE_URL" in keys
    assert "SECRET_KEY" in keys
    assert "DEBUG" in keys

    # CRITICAL: Verify values are NEVER stored in metadata or node attributes
    metadata_str = str(node.metadata)
    assert "supersecretpass" not in metadata_str
    assert "1234567890abcdef" not in metadata_str
    assert "True" not in metadata_str


def test_manifests_external_dependencies_collapsed():
    """Verify package.json dependencies are collapsed into one external dependencies node."""
    files_data = {
        "package.json": '{"dependencies": {"react": "^18.2.0", "axios": "^1.0.0"}}',
        "main.py": "print('hello')",
    }
    file_index = [("package.json", "json"), ("main.py", "python")]
    reader = lambda p: files_data[p]

    sys_map = build_system_map(file_index, reader)

    ext_nodes = [n for n in sys_map.nodes if n.kind == "external_deps"]
    assert len(ext_nodes) == 1
    ext_node = ext_nodes[0]
    assert ext_node.metadata["count"] == 2
    assert "react" in ext_node.metadata["samples"]
    assert "axios" in ext_node.metadata["samples"]

