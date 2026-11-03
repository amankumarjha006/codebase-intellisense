"""Data flow extraction and tracing seeded from route handlers."""

import ast
from collections import defaultdict
import posixpath
import re
from typing import Callable, Sequence

from .schemas import (
    ComponentOut,
    DataFlowOut,
    FlowCitation,
    FlowEntry,
    FlowStep,
    GraphEdgeOut,
)

MAX_FLOWS_COUNT = 6
MAX_STEPS_PER_FLOW = 8


def trace_data_flows(
    files: Sequence[tuple[str, str]],  # (file_path, language)
    read_file: Callable[[str], str],
    components: list[ComponentOut],
    file_to_component: dict[str, str],
    edges: list[GraphEdgeOut],
) -> list[DataFlowOut]:
    """Detect entrypoint route handlers and trace end-to-end data flows downward

    through the component graph in layer order.
    """
    comp_by_id = {c.id: c for c in components}

    # Build downstream adjacency map: component -> list of (target_component, weight, evidence_samples)
    downstream: dict[str, list[tuple[str, int, list]]] = defaultdict(list)
    for edge in edges:
        src_layer = comp_by_id.get(edge.source, None)
        tgt_layer = comp_by_id.get(edge.target, None)
        # Follow downward in layer order or same layer if distinct
        if src_layer and tgt_layer and tgt_layer.layer >= src_layer.layer:
            downstream[edge.source].append((edge.target, edge.weight, edge.evidence))

    # Sort downstream edges by weight descending for greedy strongest path
    for src in downstream:
        downstream[src].sort(key=lambda item: -item[1])

    # 1. Detect routes
    routes = detect_route_handlers(files, read_file)
    if not routes:
        return []

    flows: list[DataFlowOut] = []
    flow_counter = 1

    for r_method, r_path, r_file, r_line, r_end_line in routes:
        if len(flows) >= MAX_FLOWS_COUNT:
            break

        start_comp_id = file_to_component.get(r_file)
        if not start_comp_id or start_comp_id not in comp_by_id:
            continue

        flow_id = f"flow_{flow_counter}_{r_method.lower()}_{re.sub(r'[^a-zA-Z0-9]+', '_', r_path).strip('_')}"
        title = f"{r_method} {r_path}"

        entry = FlowEntry(
            kind="http_route",
            method=r_method,
            path=r_path,
            file=r_file,
            line=r_line,
        )

        steps: list[FlowStep] = []
        visited_comps: set[str] = set()

        # Step 1: Entry component
        steps.append(
            FlowStep(
                component_id=start_comp_id,
                caption=None,
                citations=[
                    FlowCitation(
                        file_path=r_file,
                        start_line=r_line,
                        end_line=r_end_line,
                    )
                ],
            )
        )
        visited_comps.add(start_comp_id)

        # Trace downward
        curr_comp = start_comp_id
        while len(steps) < MAX_STEPS_PER_FLOW:
            candidates = [
                (tgt, w, ev)
                for tgt, w, ev in downstream.get(curr_comp, [])
                if tgt not in visited_comps
            ]
            if not candidates:
                break

            next_comp, weight, evidence_list = candidates[0]
            citations: list[FlowCitation] = []
            for ev in evidence_list[:2]:
                citations.append(
                    FlowCitation(
                        file_path=ev.target_path,
                        start_line=ev.line,
                        end_line=ev.line + 10,
                    )
                )

            steps.append(
                FlowStep(
                    component_id=next_comp,
                    caption=None,
                    citations=citations,
                )
            )
            visited_comps.add(next_comp)
            curr_comp = next_comp

        flows.append(
            DataFlowOut(
                id=flow_id,
                title=title,
                entry=entry,
                steps=steps,
            )
        )
        flow_counter += 1

    return flows


def detect_route_handlers(
    files: Sequence[tuple[str, str]],
    read_file: Callable[[str], str],
) -> list[tuple[str, str, str, int, int]]:
    """Scan files for HTTP routes (FastAPI, Flask, Express, Next.js).

    Returns list of (method, path, file_path, start_line, end_line).
    """
    routes: list[tuple[str, str, str, int, int]] = []

    for rel_path, lang in files:
        norm = rel_path.replace("\\", "/")
        lower = norm.lower()

        # Python route detection
        if lang.lower() == "python" or lower.endswith(".py"):
            if any(term in lower for term in ("api", "endpoint", "route", "view", "controller", "main", "app")):
                try:
                    content = read_file(norm)
                    tree = ast.parse(content, filename=norm)
                    for node in ast.walk(tree):
                        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                            for dec in node.decorator_list:
                                if isinstance(dec, ast.Call):
                                    func = dec.func
                                    if isinstance(func, ast.Attribute) and func.attr.upper() in (
                                        "GET",
                                        "POST",
                                        "PUT",
                                        "DELETE",
                                        "PATCH",
                                        "ROUTE",
                                    ):
                                        method = "ANY" if func.attr.upper() == "ROUTE" else func.attr.upper()
                                        path = "/"
                                        if dec.args and isinstance(dec.args[0], ast.Constant):
                                            path = str(dec.args[0].value)
                                        end_line = getattr(node, "end_lineno", node.lineno + 15)
                                        routes.append((method, path, norm, node.lineno, end_line))
                except Exception:
                    continue

        # Next.js / Express route detection
        elif lower.endswith((".ts", ".tsx", ".js", ".jsx")):
            if "route.ts" in lower or "route.js" in lower:
                # Next.js App Router route.ts
                try:
                    content = read_file(norm)
                    for method in ("GET", "POST", "PUT", "DELETE", "PATCH"):
                        m = re.search(rf"\bexport\s+(?:async\s+)?function\s+{method}\b", content)
                        if m:
                            line_no = content[: m.start()].count("\n") + 1
                            route_path = "/" + posixpath.dirname(norm).replace("app/api", "").replace("src/app/api", "").strip("/")
                            routes.append((method, route_path or "/", norm, line_no, line_no + 20))
                except Exception:
                    continue
            elif any(term in lower for term in ("route", "api", "controller", "server", "app")):
                # Express router calls: router.get('/...', ...), app.post('/...', ...)
                try:
                    content = read_file(norm)
                    pattern = re.compile(r"\b(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['\"]([^'\"]+)['\"]", re.IGNORECASE)
                    for match in pattern.finditer(content):
                        method = match.group(1).upper()
                        path = match.group(2)
                        line_no = content[: match.start()].count("\n") + 1
                        routes.append((method, path, norm, line_no, line_no + 15))
                except Exception:
                    continue

    # Deduplicate and sort routes deterministically
    seen: set[tuple[str, str]] = set()
    unique_routes: list[tuple[str, str, str, int, int]] = []
    for r in sorted(routes, key=lambda x: (x[1], x[0], x[2])):
        key = (r[0], r[1])
        if key not in seen:
            seen.add(key)
            unique_routes.append(r)

    return unique_routes

