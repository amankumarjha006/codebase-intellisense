# Database Entity-Relationship Diagram (ERD)

This diagram visualizes the Codebase Intelligence database schema. It is separated into logical domains to maintain readability.

## 1. Core Data & Authentication ERD

```mermaid
erDiagram
    USER {
        uuid id PK
        string email
        string full_name
        timestamp created_at
    }

    GITHUB_ACCOUNT {
        uuid id PK
        uuid user_id FK
        string github_user_id
        string username
        timestamp created_at
    }

    GITHUB_INSTALLATION {
        uuid id PK
        uuid github_account_id FK
        string installation_id
        string target_type
        timestamp created_at
    }

    USER_REPOSITORY {
        uuid id PK
        uuid user_id FK
        uuid repository_id FK
        timestamp created_at
    }

    REPOSITORY {
        uuid id PK
        uuid github_installation_id FK "nullable"
        string github_repo_id
        string owner
        string name
        string clone_url "Used with installation token to perform git clone"
        boolean is_private
        timestamp created_at
    }

    USER ||--|| GITHUB_ACCOUNT : has
    GITHUB_ACCOUNT ||--o{ GITHUB_INSTALLATION : authorizes
    GITHUB_INSTALLATION ||--o{ REPOSITORY : tracks
    USER ||--o{ USER_REPOSITORY : has_access
    REPOSITORY ||--o{ USER_REPOSITORY : accessed_by
```

## 2. Code Intelligence & Indexing ERD

```mermaid
erDiagram
    REPOSITORY {
        uuid id PK
    }

    REPOSITORY_VERSION {
        uuid id PK
        uuid repository_id FK
        string commit_sha
        string branch
        string index_status
        timestamp indexed_at
    }

    INDEX_JOB {
        uuid id PK
        uuid repository_id FK
        uuid repository_version_id FK
        string status
        string error_message
        timestamp started_at
        timestamp completed_at
    }

    FILE {
        uuid id PK
        uuid repository_version_id FK
        string file_path
        string file_name
        string language
        integer size_bytes
        string hash
    }

    SYMBOL {
        uuid id PK
        uuid file_id FK
        string name
        string qualified_name
        string symbol_type
        integer start_line
        integer end_line
    }

    CODE_CHUNK {
        uuid id PK
        uuid file_id FK
        uuid symbol_id FK "nullable"
        text content
        integer start_line
        integer end_line
        integer chunk_index
    }

    EMBEDDING {
        uuid id PK
        uuid code_chunk_id FK
        string model_name
        vector embedding
    }

    SYMBOL_RELATIONSHIP {
        uuid id PK
        uuid repository_version_id FK
        uuid source_symbol_id FK
        uuid target_symbol_id FK
        string relationship_type "CALLS, REFERENCES, INHERITS, IMPLEMENTS"
    }

    FILE_RELATIONSHIP {
        uuid id PK
        uuid repository_version_id FK
        uuid source_file_id FK
        uuid target_file_id FK
        string relationship_type "IMPORTS, DEPENDS_ON"
    }

    ANALYSIS_RESULT {
        uuid id PK
        uuid repository_version_id FK
        string analysis_type
        jsonb payload
    }

    REPOSITORY ||--o{ REPOSITORY_VERSION : snapshots
    REPOSITORY ||--o{ INDEX_JOB : executes
    REPOSITORY_VERSION ||--o{ INDEX_JOB : tracked_by
    REPOSITORY_VERSION ||--o{ FILE : contains
    REPOSITORY_VERSION ||--o{ SYMBOL_RELATIONSHIP : bounds
    REPOSITORY_VERSION ||--o{ FILE_RELATIONSHIP : bounds
    REPOSITORY_VERSION ||--o{ ANALYSIS_RESULT : generates
    FILE ||--o{ SYMBOL : declares
    FILE ||--o{ CODE_CHUNK : split_into
    SYMBOL ||--o{ CODE_CHUNK : bounds
    CODE_CHUNK ||--|| EMBEDDING : embedded_as
    SYMBOL ||--o{ SYMBOL_RELATIONSHIP : source
    SYMBOL ||--o{ SYMBOL_RELATIONSHIP : target
    FILE ||--o{ FILE_RELATIONSHIP : source
    FILE ||--o{ FILE_RELATIONSHIP : target
```

## 3. Chat & Citations ERD

```mermaid
erDiagram
    REPOSITORY {
        uuid id PK
    }

    USER {
        uuid id PK
    }

    CONVERSATION {
        uuid id PK
        uuid repository_id FK
        uuid user_id FK
        uuid repository_version_id FK "grounded state"
        string title
        timestamp created_at
    }

    MESSAGE {
        uuid id PK
        uuid conversation_id FK
        string role "user, assistant, system"
        text content
        timestamp created_at
    }

    CITATION {
        uuid id PK
        uuid message_id FK
        uuid code_chunk_id FK "nullable"
        string file_path "provenance"
        integer start_line "provenance"
        integer end_line "provenance"
    }

    USER ||--o{ CONVERSATION : initiates
    REPOSITORY ||--o{ CONVERSATION : context_for
    CONVERSATION ||--o{ MESSAGE : contains
    MESSAGE ||--o{ CITATION : cites
```
