# ADR 004: Tree-sitter for Source Parsing

## Context
To enable deep code intelligence, semantic chunking, and relationship extraction, the platform must understand the structure of the source code. Regular expressions and naive text splitting are insufficient for generating high-quality context for the AI or accurately mapping repository architecture.

## Decision
We will use **Tree-sitter** as the primary source code parsing technology to generate Abstract Syntax Trees (ASTs).

## Reason
- **Polyglot Support**: Tree-sitter supports almost all major programming languages using a consistent interface.
- **Robustness**: It handles syntax errors gracefully, allowing partial parsing of incomplete or broken code.
- **Performance**: It is written in C and is extremely fast, making it suitable for parsing large repositories during background ingestion.
- **Query Language**: Tree-sitter provides a powerful Lisp-like query language that makes it easy to extract symbols (functions, classes) and specific relationships (imports, calls) without writing complex AST traversal logic.

## Alternatives Considered
- **Language Server Protocol (LSP)**: Rejected for MVP because running a full LSP server for every language per repository is highly resource-intensive and complex to orchestrate.
- **Regex / Text Parsers**: Rejected due to inaccuracy and inability to handle nested scopes or complex language features.
- **Python `ast` / Framework-specific parsers**: Rejected because they only support a single language.

## Consequences
- The architecture must distinguish between "syntax-level understanding" (Tree-sitter's domain) and "repository-level understanding" (the knowledge graph we build).
- We must maintain language-specific Tree-sitter grammars and query files.
