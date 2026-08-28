---
name: codebase-indexing
description: Designs and implements the repository ingestion and code intelligence pipeline using GitHub repositories, file filtering, Tree-sitter parsing, AST analysis, symbol extraction, relationships, code chunking, metadata, and embeddings. Use when working on repository analysis or indexing.
---

# Codebase Indexing Skill

## Purpose

Convert a GitHub repository into a structured and searchable Codebase Knowledge Layer.

## Pipeline

The canonical pipeline is:

Repository
→ Fetch
→ File Discovery
→ File Filtering
→ Language Detection
→ Tree-sitter Parsing
→ AST
→ Symbol Extraction
→ Relationship Extraction
→ Code Chunking
→ Metadata
→ Embeddings
→ Persistence

Do not bypass the pipeline without a clear reason.

## Repository Fetching

Support:

- GitHub API metadata
- Public repository URLs
- Authenticated access to authorized repositories

Repository data must retain:

- Owner
- Repository name
- URL
- Default branch
- Commit/version information where available

## File Filtering

Initially exclude:

- .git
- node_modules
- dist
- build
- coverage
- __pycache__
- vendor
- binary files
- generated files where detectable

Filtering should be configurable.

## Parsing

Use Tree-sitter for syntax-aware parsing.

Do not rely exclusively on regex for source-code structure.

Extract where supported:

- Functions
- Classes
- Methods
- Interfaces
- Imports
- Exports
- Calls
- Inheritance
- Implementations
- References

## Symbols

Symbols should retain enough metadata to locate the original source.

Recommended metadata:

- Repository ID
- File ID
- Symbol name
- Symbol type
- Start line
- End line
- Parent symbol
- Language

## Relationships

Represent relationships explicitly.

Examples:

- IMPORTS
- CALLS
- EXPORTS
- INHERITS
- IMPLEMENTS
- REFERENCES

Do not invent relationships when source evidence is insufficient.

## Chunking

Chunks should preserve source provenance.

Each chunk should retain:

- Repository
- File path
- Language
- Symbol
- Start line
- End line
- Parent symbol where applicable
- Related metadata

Prefer syntax-aware chunks over arbitrary fixed-size text splitting.

## Embeddings

Embeddings should be generated from meaningful code chunks and metadata.

Never embed ignored/generated/binary content.

Embedding operations should be resilient to provider failures.

## Incremental Indexing

The architecture should allow future incremental indexing.

Do not design the system so that updating one file requires rebuilding the entire repository forever.

## Reliability

Indexing must be:

- Repeatable
- Observable
- Recoverable
- Idempotent where practical

Track indexing status and errors.

## Critical Rule

The indexer is the source of structured repository knowledge.

Do not depend on the LLM to discover basic repository structure that can be deterministically extracted from source code.