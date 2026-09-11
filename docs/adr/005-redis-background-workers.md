# ADR 005: Redis and Background Workers for Indexing

## Context
Repository indexing (fetching, parsing, chunking, embedding generation) is a computationally intensive and time-consuming process. Performing this synchronously within an API request would lead to HTTP timeouts, poor user experience, and API instability.

## Decision
We will use **Redis** and a background job queue (e.g., Celery, RQ, or ARQ) with dedicated **Background Workers** to handle the repository indexing pipeline.

## Reason
- **Asynchronous Execution**: Decouples long-running analysis from the web request lifecycle, allowing the API to respond immediately and the client to poll or receive updates on the job's progress.
- **Scalability**: Workers can be scaled independently of the API web servers based on the ingestion workload.
- **Resilience**: A job queue provides retry mechanisms, failure tracking, and visibility into indexing states (QUEUED, FETCHING, INDEXING, READY, FAILED).
- **Resource Management**: Indexing requires CPU (for Tree-sitter parsing) and external API calls (for embeddings). A queue allows for rate limiting and concurrency control.

## Alternatives Considered
- **Synchronous API Execution**: Rejected due to timeout limits and poor UX.
- **In-memory Background Tasks (FastAPI BackgroundTasks)**: Rejected because they are lost if the server restarts, cannot easily be scaled across multiple instances, and lack robust failure management.
- **RabbitMQ / Kafka**: Rejected as overengineering for the MVP. Redis is already part of the stack and is sufficient for a lightweight job queue.

## Consequences
- Requires Redis infrastructure (already in `docker-compose.yml`).
- Requires a separate worker process in the Docker/deployment topology.
- API endpoints must be designed to return Job IDs and provide status polling endpoints.
