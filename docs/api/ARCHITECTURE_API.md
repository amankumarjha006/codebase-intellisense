# Architecture V2 API

The Architecture V2 API provides evidence-based architectural analysis of indexed repositories across three unified dimensions:
1. **System Map**: Execution targets, containers, deployment topology, and external dependencies derived from manifest files.
2. **Component Map**: Logical directory-based component grouping (8-20 components, hard cap 40) with aggregated resolved dependency edges, cycle detection (Tarjan SCC), and topological layering.
3. **Data Flows**: Seeded from detected HTTP route handlers and traced downward through the component dependency graph.

All architecture data is version-pinned to the active repository version and computed idempotently during the `ANALYZING` stage of repository ingestion.

---

## 1. Get Repository Architecture

Retrieves the complete Architecture V2 payload for the active version of a repository.

- **Method**: `GET`
- **Path**: `/api/v1/repositories/{repository_id}/architecture`
- **Authentication**: Required (Session Cookie)
- **Rate Limit**: General tier (`general_rate_limiter`)

### Path Parameters
| Name | Type | Description |
| :--- | :--- | :--- |
| `repository_id` | UUID | Unique identifier of the repository |

### Responses

#### `200 OK`
Returns the `ArchitectureOut` payload (schema version 2).

```json
{
  "schema_version": 2,
  "status": "ready",
  "system": {
    "nodes": [
      {
        "id": "sys_service_web",
        "name": "Service: web",
        "kind": "service",
        "metadata": {
          "image": "nginx:alpine",
          "ports": ["80:80"],
          "depends_on": ["api"]
        },
        "source_file": "docker-compose.yml",
        "line_number": 4
      },
      {
        "id": "sys_external_deps",
        "name": "External dependencies (42)",
        "kind": "external_deps",
        "metadata": {
          "count": 42,
          "samples": ["fastapi", "pydantic", "sqlalchemy"]
        },
        "source_file": "pyproject.toml",
        "line_number": 1
      }
    ],
    "edges": [
      {
        "source": "sys_service_web",
        "target": "sys_service_api",
        "label": "depends_on"
      }
    ]
  },
  "components": [
    {
      "id": "comp_server_app_api",
      "name": "server/app/api",
      "path_prefix": "server/app/api",
      "file_count": 10,
      "language_mix": {
        "python": 10
      },
      "layer": 0,
      "summary": null
    },
    {
      "id": "comp_server_app_services",
      "name": "server/app/services",
      "path_prefix": "server/app/services",
      "file_count": 25,
      "language_mix": {
        "python": 25
      },
      "layer": 1,
      "summary": null
    }
  ],
  "edges": [
    {
      "source": "comp_server_app_api",
      "target": "comp_server_app_services",
      "weight": 14,
      "kind": "internal",
      "cycle": false,
      "evidence": [
        {
          "source_path": "server/app/api/v1/endpoints/repositories.py",
          "target_path": "server/app/services/repository.py",
          "line": 22
        }
      ]
    }
  ],
  "flows": [
    {
      "id": "flow_1_get_repositories",
      "title": "GET /repositories",
      "entry": {
        "kind": "http_route",
        "method": "GET",
        "path": "/repositories",
        "file": "server/app/api/v1/endpoints/repositories.py",
        "line": 65
      },
      "steps": [
        {
          "component_id": "comp_server_app_api",
          "caption": null,
          "citations": [
            {
              "file_path": "server/app/api/v1/endpoints/repositories.py",
              "start_line": 65,
              "end_line": 80
            }
          ]
        },
        {
          "component_id": "comp_server_app_services",
          "caption": null,
          "citations": [
            {
              "file_path": "server/app/services/repository.py",
              "start_line": 22,
              "end_line": 32
            }
          ]
        }
      ]
    }
  ],
  "coverage": {
    "internal_imports_total": 810,
    "resolved": 810,
    "ratio": 1.0,
    "languages_analyzed": ["python", "tsx", "typescript"],
    "languages_not_analyzed": [
      {
        "language": "go",
        "files": 4
      }
    ]
  },
  "limits": {
    "truncated": false,
    "max_components": 40
  },
  "generated_at": "2026-11-04T02:00:00Z",
  "error": null
}
```

#### `401 Unauthorized`
Session cookie is missing or invalid.
```json
{
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Authentication required."
  }
}
```

#### `404 Not Found`
Returned when the repository does not exist, the authenticated user does not own it (anti-leakage guarantee), the repository has no active version, or analysis has not been generated.
```json
{
  "error": {
    "code": "ANALYSIS_NOT_FOUND",
    "message": "Architecture analysis not found for the active version."
  }
}
```

---

## 2. Get Component Files

Retrieves a paginated list of files belonging to a specific architectural component.

- **Method**: `GET`
- **Path**: `/api/v1/repositories/{repository_id}/architecture/components/{component_id}/files`
- **Authentication**: Required (Session Cookie)
- **Rate Limit**: General tier (`general_rate_limiter`)

### Path Parameters
| Name | Type | Description |
| :--- | :--- | :--- |
| `repository_id` | UUID | Unique identifier of the repository |
| `component_id` | string | Identifier of the component (e.g. `comp_server_app_api`) |

### Query Parameters
| Name | Type | Default | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `page` | integer | `1` | `>= 1` | Page number |
| `limit` | integer | `50` | `1 <= limit <= 150` | Number of files per page (hard-capped at 150) |

### Responses

#### `200 OK`
Returns `ComponentFilesOut`:
```json
{
  "component_id": "comp_server_app_api",
  "total": 10,
  "page": 1,
  "limit": 50,
  "files": [
    {
      "path": "server/app/api/v1/endpoints/repositories.py",
      "language": "python",
      "size_bytes": 32768
    }
  ]
}
```

#### `404 Not Found`
If the component does not exist in the active architecture analysis:
```json
{
  "error": {
    "code": "COMPONENT_NOT_FOUND",
    "message": "Component 'comp_nonexistent' not found in active architecture analysis."
  }
}
```

