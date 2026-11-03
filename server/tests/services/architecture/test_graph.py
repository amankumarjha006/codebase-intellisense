"""Tests for graph aggregation, cycle detection, layering, and edge capping."""

from app.services.architecture.graph import build_architecture_graph
from app.services.architecture.schemas import ComponentOut
from app.services.architecture.types import ImportEvidence


def test_graph_aggregation_and_evidence():
    comps = [
        ComponentOut(id="c_api", name="api", path_prefix="api", file_count=2, language_mix={"python": 2}),
        ComponentOut(id="c_svc", name="services", path_prefix="services", file_count=2, language_mix={"python": 2}),
    ]
    file_map = {
        "api/routes.py": "c_api",
        "services/user.py": "c_svc",
    }
    evidences = [
        ImportEvidence(source_file="api/routes.py", target_file="services/user.py", specifier="services.user", line_number=10, kind="internal"),
        ImportEvidence(source_file="api/routes.py", target_file="services/user.py", specifier="services.user", line_number=20, kind="internal"),
    ]

    edges, truncated = build_architecture_graph(comps, file_map, evidences)

    assert not truncated
    assert len(edges) == 1
    edge = edges[0]
    assert edge.source == "c_api"
    assert edge.target == "c_svc"
    assert edge.weight == 2
    assert not edge.cycle
    assert len(edge.evidence) == 2


def test_graph_cycle_detection():
    """Verify cyclic dependencies between components are detected and marked cycle=True."""
    comps = [
        ComponentOut(id="c_a", name="a", path_prefix="a", file_count=1, language_mix={"python": 1}),
        ComponentOut(id="c_b", name="b", path_prefix="b", file_count=1, language_mix={"python": 1}),
    ]
    file_map = {"a/mod.py": "c_a", "b/mod.py": "c_b"}
    evidences = [
        ImportEvidence(source_file="a/mod.py", target_file="b/mod.py", specifier="b", line_number=1, kind="internal"),
        ImportEvidence(source_file="b/mod.py", target_file="a/mod.py", specifier="a", line_number=1, kind="internal"),
    ]

    edges, truncated = build_architecture_graph(comps, file_map, evidences)

    assert len(edges) == 2
    for e in edges:
        assert e.cycle is True


def test_graph_layering_order():
    """Verify layering flows from entry (layer 0) to data (layer 2)."""
    comps = [
        ComponentOut(id="c_entry", name="entry", path_prefix="entry", file_count=1, language_mix={"python": 1}),
        ComponentOut(id="c_svc", name="svc", path_prefix="svc", file_count=1, language_mix={"python": 1}),
        ComponentOut(id="c_db", name="db", path_prefix="db", file_count=1, language_mix={"python": 1}),
    ]
    file_map = {"entry/main.py": "c_entry", "svc/biz.py": "c_svc", "db/models.py": "c_db"}
    evidences = [
        ImportEvidence(source_file="entry/main.py", target_file="svc/biz.py", specifier="svc", line_number=1, kind="internal"),
        ImportEvidence(source_file="svc/biz.py", target_file="db/models.py", specifier="db", line_number=1, kind="internal"),
    ]

    build_architecture_graph(comps, file_map, evidences)

    comp_dict = {c.id: c for c in comps}
    assert comp_dict["c_entry"].layer == 0
    assert comp_dict["c_svc"].layer == 1
    assert comp_dict["c_db"].layer == 2


def test_graph_edge_capping():
    """Verify edges are capped at max_edges (default 400) and truncated flag is set."""
    comps = [
        ComponentOut(id=f"c_{i}", name=f"comp_{i}", path_prefix=f"p_{i}", file_count=1, language_mix={"python": 1})
        for i in range(30)
    ]
    file_map = {f"p_{i}/f.py": f"c_{i}" for i in range(30)}
    evidences = []
    # Create 50 distinct edges
    for i in range(10):
        for j in range(10, 15):
            evidences.append(
                ImportEvidence(source_file=f"p_{i}/f.py", target_file=f"p_{j}/f.py", specifier="test", line_number=1, kind="internal")
            )

    edges, truncated = build_architecture_graph(comps, file_map, evidences, max_edges=10)
    assert len(edges) == 10
    assert truncated is True

