"""Tests for route detection and data flow tracing."""

from app.services.architecture.flows import detect_route_handlers, trace_data_flows
from app.services.architecture.schemas import ComponentOut, EvidenceItem, GraphEdgeOut


def test_detect_route_handlers():
    files_data = {
        "api/endpoints.py": """
@router.get("/users")
def get_users():
    return []

@router.post("/users/{user_id}")
async def update_user(user_id: int):
    return {}
""",
        "server/routes.js": """
app.get("/items", (req, res) => res.send([]));
router.delete("/items/:id", (req, res) => res.send());
""",
    }
    file_index = [
        ("api/endpoints.py", "python"),
        ("server/routes.js", "javascript"),
    ]
    reader = lambda p: files_data[p]

    routes = detect_route_handlers(file_index, reader)

    methods = {(r[0], r[1]) for r in routes}
    assert ("GET", "/users") in methods
    assert ("POST", "/users/{user_id}") in methods
    assert ("GET", "/items") in methods
    assert ("DELETE", "/items/:id") in methods


def test_trace_data_flows_downward_layers():
    files_data = {
        "api/endpoints.py": """
@router.get("/data")
def get_data():
    pass
"""
    }
    file_index = [("api/endpoints.py", "python")]
    reader = lambda p: files_data[p]

    comps = [
        ComponentOut(id="c_api", name="api", path_prefix="api", file_count=1, language_mix={"python": 1}, layer=0),
        ComponentOut(id="c_svc", name="svc", path_prefix="svc", file_count=1, language_mix={"python": 1}, layer=1),
        ComponentOut(id="c_db", name="db", path_prefix="db", file_count=1, language_mix={"python": 1}, layer=2),
    ]
    file_to_comp = {"api/endpoints.py": "c_api"}
    edges = [
        GraphEdgeOut(
            source="c_api",
            target="c_svc",
            weight=5,
            evidence=[EvidenceItem(source_path="api/endpoints.py", target_path="svc/service.py", line=10)],
        ),
        GraphEdgeOut(
            source="c_svc",
            target="c_db",
            weight=3,
            evidence=[EvidenceItem(source_path="svc/service.py", target_path="db/models.py", line=20)],
        ),
    ]

    flows = trace_data_flows(file_index, reader, comps, file_to_comp, edges)

    assert len(flows) == 1
    flow = flows[0]
    assert flow.entry.method == "GET"
    assert flow.entry.path == "/data"
    assert len(flow.steps) == 3
    assert flow.steps[0].component_id == "c_api"
    assert flow.steps[1].component_id == "c_svc"
    assert flow.steps[2].component_id == "c_db"

