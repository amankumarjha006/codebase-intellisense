# ADR 007: Repository Knowledge Graph via PostgreSQL Relationships

## Context
Code intelligence requires understanding relationships (e.g., `CONTAINS`, `IMPORTS`, `CALLS`, `DEPENDS_ON`) between files, symbols, and dependencies. This conceptually forms a Knowledge Graph. However, introducing a dedicated graph database adds significant infrastructure complexity.

## Decision
We will model the **Repository Knowledge Graph** using relational tables and foreign keys in **PostgreSQL**.

## Reason
- **MVP Simplicity**: The initial graph complexity (depth of queries) is low enough that standard SQL JOINs or recursive CTEs can handle it performantly.
- **Consolidation**: Keeps all data (relational, vectors, graph edges) in one unified datastore (PostgreSQL), drastically simplifying the architecture, backups, and local development.
- **Proven Capability**: PostgreSQL handles graph-like hierarchical data well with proper indexing and relationship tables (e.g., an `edges` table mapping `source_id` to `target_id` with an `edge_type`).

## Alternatives Considered
- **Neo4j / Dedicated Graph DB**: Rejected for the MVP due to the overhead of running a JVM-based graph DB, learning Cypher, and keeping it synchronized with PostgreSQL. It remains an option for future phases if graph traversal performance becomes a bottleneck.

## Consequences
- The schema will include tables representing Nodes (Files, Symbols, Chunks) and Edges (Relationships).
- Deep graph traversals (e.g., finding all transitive dependencies 5 levels deep) must be written carefully in SQL (CTEs) to avoid performance issues, but this is acceptable for MVP requirements.
