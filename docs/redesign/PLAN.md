# Codebase Intellisense — UI/UX & Information Design Redesign Plan (v2 Final)

**Author:** Senior Product Designer + Frontend Engineer  
**Branch:** `feat/ui-redesign`  
**Status:** Approved & Locked for Step 1  
**Date:** November 2026

---

## 1. Executive Summary & Stack Confirmation

### Tech Stack Confirmation
- **Build & Framework:** Vite `6.1.0` + React `19.0.0` + TypeScript `5.7.0`. (Confirmed: keeping this modern stack).
- **Routing:** React Router DOM `v7.18.4` with nested layout routes under `AppLayout`.
- **Styling:** Tailwind CSS `v4.1.0` with `@theme` token definitions in `index.css`.
- **Primitives:** Radix UI primitives (`@radix-ui/react-*`), `sonner` (toasts), `cmdk` (⌘K palette), `react-resizable-panels` (multi-pane layouts).
- **Data & Schema Layer:** `@tanstack/react-query` v5 for caching/swapping + `zod` for contract validation. Unified client data layer where real API and explicit mock adapters share identical TypeScript interfaces.
- **Graph & Visualization:** `@xyflow/react` (`12.3.6`) + `elkjs` (`^0.9.3`). **ELK layout calculations are executed inside a dedicated Web Worker** (`client/src/lib/architecture/elkWorker.ts`) to prevent UI jank during rendering.
- **Charts:** `recharts` (`3.10.1`), restricted to minimal, unclipped tabular sparklines and single horizontal stacked bars (no decorative area charts).
- **Code & Citations:** `shiki` (`3.23.0`) for verified syntax highlighting with line highlighting for citations + `react-markdown` and `remark-gfm` for chat responses.
- **Micro-Interactions & Motion:** `motion` (`14.3.0`), subtle transitions (150–220ms ease-out), shared-layout tab indicators (`layoutId`), staggered list entry; zero looping marketing animations; strictly respects `prefers-reduced-motion`.
- **Icons (One Approach Only):** Migrated exclusively to `@material-symbols/svg-400` (rounded style) with SVGR so icons take `currentColor`. No full font package, no external Google Fonts CDN links.

### Confirmed Pinned Dependencies (npm ls)
```
codebase-intellisense-client@0.1.0
+-- @xyflow/react@12.3.6
+-- motion@14.3.0
+-- react-router-dom@7.18.4
|   `-- react-router@7.18.4
+-- recharts@3.10.1
`-- shiki@3.23.0
```

---

## 2. Root Cause & Proof of the Serif Font Bug (Blocker 1)

### The Actual Root Cause
While `@fontsource-variable/google-sans-flex` was declared as `'Google Sans FlexVariable'` (missing space) in `client/src/index.css:44`, the `body` font-family chain still ended with `system-ui, -apple-system, sans-serif`. Thus, pages normally defaulted to sans-serif.

The **actual trigger for the browser serif (Times New Roman)** on the "Architecture" `h1` and "System connections" label was discovered in [`client/src/pages/ArchitecturePage.tsx:118`](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/ArchitecturePage.tsx#L118):
```tsx
<AnimatedPage className="min-h-screen bg-[#0F0F0E] text-white/90 flex flex-col font-['Google_Sans_Flex']">
```
- In Tailwind CSS, the arbitrary class `font-['Google_Sans_Flex']` produces:
  ```css
  font-family: 'Google_Sans_Flex';
  ```
  **with zero fallback font specified**.
- The system and font registry have no font registered as `"Google_Sans_Flex"` (with underscores).
- Per the CSS Fonts Module Level 4 specification (§ 5.2): when no font in a font-family list matches and no generic fallback (`sans-serif`) is provided, the user agent falls back to the document initial font, which on Windows/Chrome/Firefox is the user-agent standard serif font (`Times New Roman`).
- Both the `<h1>Architecture</h1>` header (line 126) and `<h4 ...>System Connections</h4>` inside [`SystemMapView.tsx:99`](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/components/architecture/SystemMapView.tsx#L99) inherit this exact declaration from the enclosing `AnimatedPage`.

### The Fix
1. Remove `font-['Google_Sans_Flex']` from `ArchitecturePage.tsx:118` so it cleanly inherits `--font-sans`.
2. Fix `client/src/index.css`:
   ```css
   --font-sans: 'Google Sans Flex Variable', 'Google Sans Flex', 'Figtree', system-ui, -apple-system, sans-serif;
   --font-mono: 'Google Sans Code Variable', 'Google Sans Code', 'JetBrains Mono', ui-monospace, monospace;
   ```
3. Set explicit `font-sans` on all SVG text nodes in React Flow / Elk.

---

## 3. Visual System Tokens & Theme Specs

```css
:root {
  /* Surfaces: 3 elevations relying on tonal contrast, not heavy card borders */
  --surface-base: #0B0D10;
  --surface-raised: #111419;
  --surface-overlay: #171B22;

  /* Hairlines: tables, inputs, subtle dividers */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.16);

  /* Text hierarchy */
  --text-primary: #E8EAED;
  --text-secondary: #9AA0A6;
  --text-tertiary: #6F757C;

  /* Accent: restrained to citations, active links, selection, and primary action */
  --accent: #8AB4F8;
  --accent-tint: rgba(138, 180, 248, 0.12);
  --accent-border: rgba(138, 180, 248, 0.28);

  /* Status indicators: 6-8px dots + text, never giant pill badges */
  --status-ready: #81C995;
  --status-indexing: #FDD663;
  --status-failed: #F28B82;

  /* Density & Dimensions */
  --radius-card: 8px;
  --radius-control: 6px;
  --rail-width: 56px;
  --content-max-width: 1200px;
}
```

---

## 4. Chat Failure & In-Flight Lock Protocol (Blocker 2)

### Backend Mechanism & Duplicate User Message Problem
- `server/app/services/conversation/streaming_service.py:113-118`:
  ```python
  # 3. Persist User Message (TX1)
  user_msg = Message(conversation_id=conversation.id, role="user", content=request.content)
  user_msg = self.message_repo.create(user_msg)
  ```
  Every call to `POST /conversations/{id}/messages/stream` creates a brand-new user message row in the database.
- Neither a `POST /conversations/{id}/regenerate` endpoint nor a `client_message_id` / `idempotency_key` exists in `server/app/schemas/message.py:23-25` (`ConversationMessageRequest` only has `content: str`).
- Calling `streamMessage()` again on failure would create a duplicate user prompt in the thread history.

### The Protocol
1. **Remove "Resume":** Only "Retry" is permitted.
2. **Block Step 4's Retry on Backend Capability:** Step 4 will list `POST /api/v1/conversations/{id}/regenerate` in Section B. Until the backend implements regeneration or idempotency keys, the retry button will not execute a raw stream call that duplicates messages; it will be marked `// TODO(backend: regenerate endpoint)`.
3. **In-Flight Lock Held by Another Client:**
   - Server returns `event: error\ndata: {"code": "CONVERSATION_GENERATION_IN_PROGRESS", ...}` (`streaming_service.py:87-93`).
   - The UI **cannot attach to another SSE stream**.
   - The UI disables composer submission and polls `GET /conversations/{id}/messages` with exponential backoff (2s $\to$ 4s $\to$ 8s up to the 180s Redis lock TTL) until the in-flight generation completes and the new assistant message appears.
4. **Rate Limit (429):** Shows a countdown timer driven by `Retry-After`.
5. **Not Found in Index:** When citations are 0 and context is insufficient (`rag/prompt.py:35-39`), renders the calm "Not found in this index" callout block.

---

## 5. Central Authentication & Error Isolation Protocol (Blocker 3)

### Single-Flight Auth Verification
- **No auto-retry of failed requests:** If an API call fails with 401 Unauthorized, the client does NOT automatically re-execute the failed request.
- **Never auto-retry mutations:** `POST /repositories/{id}/analyze`, `POST /conversations/{id}/messages/stream`, `DELETE`, etc. are NEVER automatically retried on 401.
- **Single-Flight Deduped Verification:**
  - Upon receiving a 401, the HTTP client triggers a single-flight deduped `GET /api/v1/auth/me`.
  - If multiple concurrent requests trigger 401, all wait on the exact same `GET /auth/me` promise.
  - If `GET /auth/me` returns 401, `sessionExpired` is set to `true` in `AuthContext` to display the session expiration dialog/banner.
  - If `GET /auth/me` returns 200 (transient issue), the error is returned to the user without redirecting.
- **Zod Isolation:** Zod validation errors (`DataValidationError`) have no HTTP status. Local per-panel `ErrorBoundary` instances catch schema mismatches and show a recoverable "Unexpected data format" card, preventing auth redirects.

---

## 6. Path Categorization Specification (`classifyPath`)

Expanded path classification rules located in `client/src/lib/classifyPath.ts`:
```ts
export type PathCategory = 'source' | 'test' | 'docs' | 'example' | 'config' | 'generated' | 'scripts';

export function classifyPath(filePath: string): PathCategory {
  const n = filePath.toLowerCase().replace(/\\/g, '/');

  // 1. Generated & Vendor (Excluded from hotspots & modules by default)
  if (
    n.includes('/node_modules/') || n.startsWith('node_modules/') ||
    n.includes('/vendor/') || n.startsWith('vendor/') ||
    n.includes('/dist/') || n.startsWith('dist/') ||
    n.includes('/build/') || n.startsWith('build/') ||
    n.endsWith('package-lock.json') || n.endsWith('pnpm-lock.yaml') ||
    n.endsWith('yarn.lock') || n.endsWith('uv.lock') || n.endsWith('poetry.lock') ||
    n.endsWith('.min.js') || n.endsWith('.min.css')
  ) {
    return 'generated';
  }

  // 2. Tests
  if (
    n.includes('/tests/') || n.startsWith('tests/') ||
    n.includes('/test/') || n.startsWith('test/') ||
    n.includes('/__tests__/') || n.startsWith('__tests__/') ||
    n.endsWith('_test.py') || n.startsWith('test_') || n.includes('/test_') ||
    n.endsWith('conftest.py') || n.endsWith('.test.ts') || n.endsWith('.test.tsx') ||
    n.endsWith('.spec.ts') || n.endsWith('.spec.tsx')
  ) {
    return 'test';
  }

  // 3. Examples
  if (
    n.includes('/examples/') || n.startsWith('examples/') ||
    n.includes('/example/') || n.startsWith('example/') ||
    n.includes('/docs_src/') || n.startsWith('docs_src/')
  ) {
    return 'example';
  }

  // 4. Documentation
  if (
    n.includes('/docs/') || n.startsWith('docs/') ||
    n.includes('/doc/') || n.startsWith('doc/') ||
    n.endsWith('.md') || n.endsWith('.mdx') || n.endsWith('.rst')
  ) {
    return 'docs';
  }

  // 5. Scripts & Benchmarks
  if (
    n.includes('/scripts/') || n.startsWith('scripts/') ||
    n.includes('/benchmarks/') || n.startsWith('benchmarks/')
  ) {
    return 'scripts';
  }

  // 6. Configuration & Deployment
  if (
    n.endsWith('dockerfile') || n.includes('docker-compose') ||
    n.endsWith('.env') || n.endsWith('.env.example') ||
    n.endsWith('pyproject.toml') || n.endsWith('package.json') ||
    n.endsWith('tsconfig.json') || n.endsWith('requirements.txt') ||
    n.endsWith('.yaml') || n.endsWith('.yml')
  ) {
    return 'config';
  }

  // 7. Core Application Source
  return 'source';
}
```

---

## 7. Mobile Behavior Specification (< 768px / 390px Viewport)

1. **Navigation Shell on Mobile:**
   - 56px desktop `IconRail` collapses completely.
   - 56px bottom navigation bar appears with 4 primary touch targets: `Home`, `Repositories`, `Search`, `Account`.
   - Top bar shrinks to 48px with compact breadcrumb (`repo-name`), active status dot, and ⌘K trigger.
2. **Chat Screen on Mobile:**
   - Center thread is full-width with sticky bottom composer.
   - Conversation history opens via a top-left drawer icon into an accessible slide-over sheet.
   - Tapping citation chip `[1]` opens the "Sources" inspector as a full-height bottom-sheet with Shiki code and target line highlighting.
3. **Repositories & Overview Tables on Mobile:**
   - Multi-column tables collapse into dense stacked cards:
     - Header: Repo name + status dot + default branch.
     - Metrics: Monospace commit sha, language, files/symbols, relative time.
4. **Architecture on Mobile:**
   - Automatically **defaults to the `List` tab** for immediate readability.

---

## 8. Indexing Polling Policy (Step 1 Specification)

- **One Shared Query Key:** `['repositories', 'indexing-status']` shared across TopBar progress chip, RepositoriesTable, and DashboardPage.
- **Active Job Gating:** Polling runs ONLY when at least one repository has `latest_job_status` in `['QUEUED', 'FETCHING', 'INDEXING', 'ANALYZING']`.
- **Exponential Backoff:** 2s $\to$ 4s $\to$ 8s $\to$ 15s max. Resets back to 2s immediately when a new re-indexing job is triggered.
- **Tab Visibility Guard:** When `document.visibilityState === 'hidden'`, all polling timers are paused.
- **Immediate Termination:** As soon as all repositories reach `READY` or `FAILED`, polling terminates (`refetchInterval: false`).

---

## 9. Required New Backend Endpoints & Fields (Section B)

### 1. `POST /api/v1/conversations/{id}/regenerate` (New Endpoint for Non-Duplicating Retry)
- **Purpose:** Re-generates assistant response for the last user prompt in conversation `{id}` without creating duplicate user message rows in the database.
- **Alternative:** Add `client_message_id: str | None` / `idempotency_key: str | None` to `ConversationMessageRequest`.

### 2. `GET /api/v1/repositories` (Enhancement to `RepositoryListItemOut`)
- `description: str | None`
- `default_branch: str`
- `languages: dict[str, int] | None`: Defined as indexed-file counts, not GitHub linguist bytes.
- `total_files: int | None`
- `total_symbols: int | None`
- `commits_behind_head: int | None`: Computed by a Celery background worker with caching/ETag, not per list request.
- `last_conversation: LastConversationSummary | None`

### 3. Cross-Origin Header Exposure (CORS Configuration)
- Add `Access-Control-Expose-Headers: Retry-After, X-Request-ID` to FastAPI CORS middleware in `server/app/main.py`.

### 4. File Hotspots Import Counts
- `imported_by_count: int` and `import_count: int` added to `FileOut` and `ComponentFilesOut`.

---

## 10. Step-by-Step Implementation Workflow & Acceptance Checks

> **Mandatory Acceptance Criteria for EVERY Step:**
> 1. `tsc --noEmit` exits with 0 errors.
> 2. `npm run lint` exits with 0 warnings/errors.
> 3. `vitest run` passes all unit/contract tests.
> 4. Responsive screenshots captured at **1440px (Desktop)** and **390px (Mobile)**.

### Step 1: Design Tokens, Typography, SVGR Icons & App Shell
- Install dependencies (`@tanstack/react-query`, `@tanstack/react-table`, `@tanstack/react-virtual`, `zod`, `react-resizable-panels`, `@material-symbols/svg-400`, `vite-plugin-svgr`).
- Configure design tokens in `index.css`.
- Fix font family declarations (`'Google Sans Flex Variable'`, `'Google Sans Code Variable'`) and remove `font-['Google_Sans_Flex']` from `ArchitecturePage.tsx:118`.
- Build `AppShell`, 56px `IconRail`, `BottomNav` (mobile), `TopBar` with backoff polling indexing chip, and `CommandPalette` (⌘K) with shortcut guards (`isInputFocused`).
- **Commit:** `feat(shell): design tokens, typography, svgr icons, and responsive app shell`

### Step 2: Repositories & Home Screens
- Implement `RepositoriesTable` with `@tanstack/react-table`. On mobile, collapses to cards.
- Implement `DashboardPage` (Home): `ContinueHero` (using user-keyed `localStorage`), `RepoCardGrid`, collapsed activity timeline, empty state.
- **Commit:** `feat(repos): repositories table and home dashboard with mobile responsive cards`

### Step 3: Shared Repo Header & Overview Screen
- Build shared `RepositoryHeader` with Motion tab underline and shortcut guards (`1`–`5`).
- Implement `RepositoryOverviewPage`: compact stat strip, `classifyPath()` utility, index health panel, hotspots table with "approximate" label, conditional index history.
- Unit tests: `classifyPath.test.ts` validating lockfiles, vendor, test, examples, and config paths.
- **Commit:** `feat(overview): repository header, stat strip, health panel, and path classifier`

### Step 4: Cited Q&A Chat & Sources Panel
- Build `ChatLayout` with `react-resizable-panels` (desktop) and slide-over sheets (mobile).
- Implement fetch-based streaming with handled failure states (lock 409 backoff polling, rate limit 429 countdown, stream disconnect recovery, "not found in index" callout).
- Implement numbered citation chips `[1]` and Shiki `SourcePanel`.
- **Commit:** `feat(chat): fetch streaming, citation chips, source inspector, and failure recovery`

### Step 5: Architecture Map & Web Worker
- Build `elkWorker.ts` for off-thread ELK layout computation.
- Build `ArchitectureView` with segmented tabs (Modules, Flows, Entry points, List). Default to `List` on mobile.
- Build `NodeInspectorDrawer` and grouped entry points (no raw `sys_*` IDs).
- **Commit:** `feat(architecture): off-thread elk graph, grouped entry points, and inspector drawer`

### Step 6: Code Search & Global Palette
- Implement `SearchPage` with Code search hitting `POST /repositories/{id}/search` and split Shiki preview pane. Symbols tab hidden.
- Wire up global `CommandPalette` (⌘K).
- **Commit:** `feat(search): code search with shiki split preview and command palette`

### Step 7: Virtualized Files Browser & Deep-Linking
- Implement full-list cached query for `GET /repositories/{id}/files`.
- Implement virtualized directory tree via `@tanstack/react-virtual`.
- Implement `CodeViewer` with Shiki syntax highlighting and deep-linking support (`?path=...&line=...` and `#L10-L20`).
- **Commit:** `feat(files): virtualized file tree and deep-linkable code viewer`

### Step 8: Playwright Smoke Test & Final Polish
- Record and commit real API response fixtures in `client/src/test/fixtures/`.
- Add Playwright E2E smoke test (`connect -> open repo -> ask prompt -> click citation`).
- Audit WCAG AA contrast, keyboard accessibility, visible focus rings, and `prefers-reduced-motion`.
- **Commit:** `test(e2e): playwright smoke suite, real api fixtures, and a11y audit`
