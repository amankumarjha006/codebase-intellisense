---
name: frontend-development
description: Builds the Next.js TypeScript frontend for repository selection, analysis progress, repository insights, architecture visualization, search, AI chat, and code viewing. Use when creating or modifying UI components, pages, state management, or frontend API integration.
---

# Frontend Development Skill

## Stack

Use:

- Next.js
- TypeScript
- React
- Tailwind CSS

## Core Screens

The MVP should contain:

1. Landing page
2. GitHub authentication
3. Repository selection
4. Public repository URL input
5. Repository analysis/progress
6. Repository dashboard
7. Technology stack
8. Project overview
9. Architecture
10. Search
11. AI chat
12. Code viewer

## UX Principles

The interface should:

- Make repository analysis easy to understand.
- Clearly show analysis progress.
- Clearly distinguish loading, ready, and failed states.
- Make AI citations clickable.
- Make referenced files easy to inspect.
- Avoid exposing backend implementation details to users.

## Component Design

Prefer reusable components.

Avoid putting large amounts of application logic directly inside page components.

Separate:

- UI
- API clients
- State
- Types
- Data transformation

## API Integration

Frontend should communicate with FastAPI through typed API clients.

Do not duplicate backend business logic in the frontend.

## AI Chat

The chat UI should support:

- User question
- Assistant answer
- Loading state
- Error state
- Source references
- File/line navigation
- Conversation history

AI-generated information should visually distinguish between:

- Answer
- Repository evidence
- Source references

## Code Viewer

Support:

- Syntax highlighting
- Line numbers
- File path
- Relevant line highlighting
- Navigation from AI citations

## Accessibility

Use:

- Semantic HTML
- Keyboard-accessible controls
- Proper labels
- Appropriate contrast
- Clear focus states

Do not sacrifice usability for visual effects.