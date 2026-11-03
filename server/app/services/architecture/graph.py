"""Dependency graph aggregation, cycle detection, layering, and edge capping."""

from collections import defaultdict
from typing import Sequence

from .schemas import ComponentOut, EvidenceItem, GraphEdgeOut
from .types import ImportEvidence

MAX_EDGES_CAP = 400
MAX_EVIDENCE_PAIRS = 3


def build_architecture_graph(
    components: list[ComponentOut],
    file_to_component: dict[str, str],
    evidences: Sequence[ImportEvidence],
    max_edges: int = MAX_EDGES_CAP,
) -> tuple[list[GraphEdgeOut], bool]:
    """Aggregate resolved imports into component edges, detect cycles, assign layers,

    and apply edge cap.
    Returns (edges, truncated).
    """
    comp_ids = {c.id for c in components}
    comp_map = {c.id: c for c in components}

    # Aggregate evidences by (source_component, target_component)
    raw_edges: dict[tuple[str, str], list[EvidenceItem]] = defaultdict(list)

    for ev in evidences:
        if ev.kind != "internal" or not ev.target_file:
            continue

        src_comp = file_to_component.get(ev.source_file)
        tgt_comp = file_to_component.get(ev.target_file)

        if not src_comp or not tgt_comp:
            continue

        if src_comp == tgt_comp:
            # Self-dependency within the same component
            continue

        raw_edges[(src_comp, tgt_comp)].append(
            EvidenceItem(
                source_path=ev.source_file,
                target_path=ev.target_file,
                line=ev.line_number,
            )
        )

    # Detect cycles using Tarjan's Strongly Connected Components (SCC)
    adj: dict[str, list[str]] = defaultdict(list)
    for src, tgt in raw_edges.keys():
        adj[src].append(tgt)

    scc_list = tarjan_scc(list(comp_ids), adj)
    node_to_scc: dict[str, int] = {}
    for scc_idx, scc_nodes in enumerate(scc_list):
        for node in scc_nodes:
            node_to_scc[node] = scc_idx

    # Assign layers using longest path on condensed DAG
    condensed_adj: dict[int, set[int]] = defaultdict(set)
    in_degree: dict[int, int] = {i: 0 for i in range(len(scc_list))}

    for src, tgt in raw_edges.keys():
        scc_src = node_to_scc[src]
        scc_tgt = node_to_scc[tgt]
        if scc_src != scc_tgt and scc_tgt not in condensed_adj[scc_src]:
            condensed_adj[scc_src].add(scc_tgt)
            in_degree[scc_tgt] += 1

    # Topological / longest-path layering from roots (in_degree == 0)
    scc_layers = compute_dag_layers(len(scc_list), condensed_adj, in_degree)

    # Assign layer to each component
    for comp in components:
        scc_idx = node_to_scc.get(comp.id, 0)
        comp.layer = scc_layers.get(scc_idx, 0)

    # Build GraphEdgeOut items
    edge_items: list[GraphEdgeOut] = []
    for (src, tgt), ev_list in raw_edges.items():
        is_cycle = node_to_scc[src] == node_to_scc[tgt] and len(scc_list[node_to_scc[src]]) > 1

        # Sort evidence deterministically and take up to MAX_EVIDENCE_PAIRS
        sorted_ev = sorted(ev_list, key=lambda e: (e.source_path, e.line, e.target_path))[
            :MAX_EVIDENCE_PAIRS
        ]

        edge_items.append(
            GraphEdgeOut(
                source=src,
                target=tgt,
                weight=len(ev_list),
                kind="internal",
                cycle=is_cycle,
                evidence=sorted_ev,
            )
        )

    # Sort edges deterministically: weight descending, then source, then target
    edge_items.sort(key=lambda e: (-e.weight, e.source, e.target))

    truncated = False
    if len(edge_items) > max_edges:
        edge_items = edge_items[:max_edges]
        truncated = True

    return edge_items, truncated


def tarjan_scc(nodes: list[str], adj: dict[str, list[str]]) -> list[list[str]]:
    """Tarjan's algorithm for strongly connected components."""
    index = 0
    indices: dict[str, int] = {}
    lowlink: dict[str, int] = {}
    on_stack: set[str] = set()
    stack: list[str] = []
    sccs: list[list[str]] = []

    def strongconnect(v: str) -> None:
        nonlocal index
        indices[v] = index
        lowlink[v] = index
        index += 1
        stack.append(v)
        on_stack.add(v)

        for w in adj.get(v, []):
            if w not in indices:
                strongconnect(w)
                lowlink[v] = min(lowlink[v], lowlink[w])
            elif w in on_stack:
                lowlink[v] = min(lowlink[v], indices[w])

        if lowlink[v] == indices[v]:
            scc: list[str] = []
            while True:
                w = stack.pop()
                on_stack.remove(w)
                scc.append(w)
                if w == v:
                    break
            sccs.append(scc)

    for node in sorted(nodes):
        if node not in indices:
            strongconnect(node)

    return sccs


def compute_dag_layers(
    num_sccs: int,
    adj: dict[int, set[int]],
    in_degree: dict[int, int],
) -> dict[int, int]:
    """Compute layer depth on condensed DAG (roots at layer 0, following edges increments layer)."""
    # Kahn's algorithm for topological order
    queue = [i for i in range(num_sccs) if in_degree.get(i, 0) == 0]
    layers = {i: 0 for i in range(num_sccs)}

    while queue:
        curr = queue.pop(0)
        curr_layer = layers[curr]
        for neighbor in adj.get(curr, []):
            if curr_layer + 1 > layers[neighbor]:
                layers[neighbor] = curr_layer + 1
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    return layers

