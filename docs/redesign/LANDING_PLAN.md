# Landing Page Redesign Plan — Codebase Intellisense (Amended)

## Role & Mission
Redesign the public landing page for **Codebase Intellisense** into an honest, crafted, and memorable product showcase that respects developer intelligence. Reject generic dark-gradient developer tool templates in favor of a clean, editorial "Paper + Ink" aesthetic with focused, high-contrast dark product preview panels.

---

## 1. CLAIMS AUDIT & REAL CODE EVIDENCE

Every sentence from [`client/src/pages/LandingPage.tsx`](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/LandingPage.tsx) audited against codebase reality.

| Current Landing Copy | Action | File:Line Evidence / Reason |
| :--- | :--- | :--- |
| `AST Verification Engine v2.4.0` (L207) | **DELETE** | Unverifiable. Tree-sitter symbol extractors exist in [`server/app/services/symbol_extractor.py`](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/server/app/services/symbol_extractor.py), but this version badge is fabricated. |
| `Answers that point to the line.` (L213) | **REWRITE** | Good sentiment, but rewrite to new approved hero copy: *"Ask the repo. Get the line."* Citation linking to start/end lines verified in [`server/app/services/citation_service.py`](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/server/app/services/citation_service.py#L1-L100). |
| `Deep codebase intelligence for distributed systems. Every architectural explanation, latency postmortem, and refactor plan strictly cited with absolute source references.` (L221-L223) | **REWRITE** | Overclaiming. The platform does not do "latency postmortems" or "refactor plans" or specialize in "distributed systems". Rewrite to: *"Connect a public GitHub repository, ask in plain English, and get answers whose citations open the exact lines of code."* |
| `Instant search ready` (L249) | **REWRITE** | Search requires prior indexing. Rewrite to clarify that indexed repositories support instant hybrid vector & AST code search ([`server/app/services/hybrid_retrieval.py`](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/server/app/services/hybrid_retrieval.py)). |
| `Status: Synchronized` (L251) | **DELETE** | Fabricated real-time state badge. |
| `workspace: /services/billing-ledger` (L273) | **DELETE** | Fabricated workspace. Replaced with real captured data from `fastapi/fastapi`. |
| `Live Verification` (L277) | **DELETE** | Fabricated status pill. |
| `"Where does the ledger handle network partition retries without double-charging?"` (L289-L290) | **DELETE** | Fabricated query about non-existent billing service. Replaced with real query from `fastapi/fastapi`. |
| `Guaranteed Atomic via ID... The transaction uses an idempotent hash lock acquired prior to DB insertion.` (L297-L300) | **DELETE** | Fabricated query response. Replaced with real captured streamed answer from Gemini on `fastapi/fastapi`. |
| `src/payments/idempotency.ts:42-58` (L317) | **DELETE** | Fabricated file path. Replaced with real file citation (`fastapi/openapi/utils.py:258-378`). |
| `Source Reference: LedgerEngine → lockTx verified` (L326-L327) | **DELETE** | Fabricated AST path. Replaced with real verified AST symbols from Tree-sitter. |
| Mock code snippet with `functionhandleCharge` (L338-L344) | **DELETE** | Hardcoded mock code with dropped whitespaces. Replaced with Shiki build-time pre-tokenized HTML with strict `white-space: pre`. |
| `Engineered for forensic codebase verification.` (L360) | **REWRITE** | Rewrite into plain English chapter heading for Scrollytelling. |
| `Zero hallucinated file paths. Every query maps to validated source code coordinates and commit snapshots.` (L363-L364) | **REWRITE** | Rewrite to honest explanation: citations are grounded in verified files and line numbers retrieved from the repository commit index ([`server/app/services/citation_service.py`](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/server/app/services/citation_service.py)). |
| `Abstract Syntax Graph Ingestion: Repositories are resolved through strict language server protocols (LSP) and Tree-sitter parsers into a deterministic semantic graph.` (L376-L377) | **REWRITE** | Delete mention of "Language Server Protocols (LSP)" — the codebase does not use LSP; it uses Tree-sitter AST parsers ([`server/app/services/chunking/ast_chunker.py`](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/server/app/services/chunking/ast_chunker.py)). |
| `Found 4,812 interfaces · 0 broken links` (L383) | **DELETE** | Fabricated metric. Replaced with real proof metrics from API: 1,221 source files analyzed, 12,499 symbols, 99.1% internal imports resolved. |
| `Symbol & Flow Tracing: Traces method execution across RPC boundaries, async queues, and database schemas with explicit call-graph validation.` (L393-L395) | **DELETE** | Fabricated capability. Codebase does static directory and import resolution, not distributed RPC/Kafka tracing. |
| `Edge: POST /checkout → Queue → Kafka` (L397) | **DELETE** | Fabricated trace. |
| `commit 9d42f8a / app.go:88-104` (L412-L414) | **DELETE** | Fabricated commit SHA and file. Replaced with real commit SHA `69c67a1` from `fastapi/fastapi`. |
| `01 Zero Synthetic Hallucinations: If a symbol is absent from the parsed AST, the system explicitly returns non-resolution...` (L440-L443) | **DELETE** | Overclaiming marketing copy. Replace with honest "What it won't do" section acknowledging LLM limitations. |
| `02 Air-Gapped Indexing: Code vectors are indexed in transient memory bounds. No model retraining, customer code telemetry, or weights fine-tuning.` (L451-L454) | **DELETE** | Factual violation. Code vectors are stored in our PostgreSQL + pgvector database, and query contexts are sent to Gemini/OpenRouter API. |
| `03 Branch Delta Diffs: Every query evaluates differences between main and your feature branches in real-time...` (L462-L465) | **DELETE** | Fabricated feature. Branch delta diffing is not implemented in the codebase. |
| `Sync your private GitHub repositories with read-only tokens.` (L485) | **REWRITE** | Restrict claim to **public repositories only**. GitHub OAuth requests `user:email` only ([`server/app/services/github.py:27`](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/server/app/services/github.py#L27)). No end-to-end private repository installation flow is currently available. |
| `SOC2 Type II certified · Read-only permissions` (L493) | **DELETE** | Fabricated certification. Delete SOC2 claim immediately. |
| Footer links: `Status`, `Documentation`, `Security`, `Terms` (L513-L516) | **DELETE** | Dead `#` anchor links. Replace with only real resolving jump-links (`#how-it-works`, `#proof`, `#privacy`). |
| `Codebase Intellisense © 2026. All rights reserved.` (L507) | **DELETE** | Removed until repository is published and licensed. Root LICENSE is currently 0 bytes; removed MIT notice and GitHub repo link from nav. |

---

## 2. REAL DEMO & PROOF DATA

### Target Repository
- **Repository:** `fastapi/fastapi` ([github.com/fastapi/fastapi](https://github.com/fastapi/fastapi))
- **Attribution Notice:** Displayed adjacent to the interactive demo: *"Demo grounded in [fastapi/fastapi](https://github.com/fastapi/fastapi) (Apache 2.0 License)"*.
- **Database UUID:** `5af31dfa-9e3f-4fcd-a3ac-c7a8e2f14c2c`
- **Active Version ID:** `c2f91ec9-f037-4fab-83aa-36157ef073ee`
- **Commit SHA:** `69c67a1672eb7f8e5b3f9019a096f4993338c689` (`69c67a1`)
- **Branch:** `master`
- **Index Timestamp:** `2026-11-05 02:28:48 UTC`

### Verified Proof Metrics (`proof.json`)
Queried directly from PostgreSQL database tables:
- **Source Files Analyzed:** `1,221` (Python: 1,217, JavaScript: 4)
- **Non-Analyzed Files Disclosed:** `244` (Markdown: 192, YAML: 38, HTML: 5, Bash: 5, CSS: 3, TOML: 1)
- **AST Symbols Extracted:** `12,499`
- **Internal Imports Resolved:** `99.1%` (2,753 of 2,778 internal imports resolved)
- **Omitted Metrics:** Chunk count (omitted per user amendment); Lines-of-code (omitted to avoid ambiguous raw vs parsed definitions).

### Verified Demo Questions (`demo.json`)
All demo questions are executed against the running backend with `gemini-3.5-flash` and fastembed hybrid retrieval.

#### Question 1 (OpenAPI Generation — Source File Grounded):
- **Query:** `"How does FastAPI generate the OpenAPI schema from route definitions and parameters?"`
- **Real Backend Citations:**
  - `fastapi/openapi/utils.py:258-378` (`generate_operation_id`, `generate_operation_summary`, `get_openapi_operation_metadata`)
- **Why this question:** Unlike `fastapi/websockets.py` (which is a 3-line re-export of Starlette), `fastapi/openapi/utils.py` contains 400+ lines of native FastAPI Python logic implementing OpenAPI 3.1.0 path and parameter resolution.

#### Question 2 (Parameter & Query Handling — Source File Grounded):
- **Query:** `"How does the Param class define query, path, and header metadata in fastapi.params?"`
- **Real Backend Citations:**
  - `fastapi/param_functions.py:375-698` (`Query`, `Path`, `Header`, `Cookie`, `Body`)
  - `fastapi/params.py:142-320` (`Param`, `Path`, `Query`, `Header`, `Cookie`)

#### Question 3 (Route Registration & Decorators):
- **Query:** `"Where are HTTP route decorators like @app.get registered on APIRouter in fastapi.routing?"`
- **Real Backend Citations:**
  - `fastapi/applications.py:4645-4816` (`add_api_route`, `get`, `post`, `put`, `delete` routing proxies)

#### Real "Not Found in this Index" Query (Recorded Reality Check):
- **Query:** `"How does Starlette implement the SessionMiddleware cookie signing mechanism?"`
- **Real Model Response:**
  > *"Based on the provided repository context, the available information is insufficient to answer how Starlette implements its `SessionMiddleware` cookie signing mechanism. The context notes that Starlette provides session and cookie support [C2], but the specific implementation details of `SessionMiddleware` (such as the signing library, secret key handling, or cryptographic algorithm used) are not present in the supplied context."*
- **Outcome:** The system declined to answer rather than hallucinating external library implementation. Displayed in Section 6 ("What it won't do").

### Human-Verification Gate Specification
- Every item in `demo.json` includes `verified: false` by default:
  ```json
  {
    "id": "q1",
    "verified": false,
    "query": "How does FastAPI generate the OpenAPI schema from route definitions and parameters?",
    "answer": "...",
    "citations": [...]
  }
  ```
- **Build Guard:** An automated check in `client/scripts/verify-demo-data.ts` and a Vitest test in `client/src/features/landing/demo.test.ts` run during `npm run build` and `npm test`. If any entry in `demo.json` has `verified: false`, the build **aborts with an error**:
  ```text
  Error: demo.json contains unverified entries. Each entry must have verified: true confirmed by a human reviewer.
  ```

---

## 3. VISUAL SYSTEM & TYPOGRAPHY SPECIFICATION

### Palette: Paper & Ink + Dark Cockpit Panels
```css
/* Light Paper + Ink Base */
--landing-bg: #F6F4EF;
--landing-surface: #FFFFFF;
--landing-surface-dim: #EDEAE3;
--landing-ink: #14161A;
--landing-ink-secondary: #5F6368;
--landing-ink-tertiary: #80868B;
--landing-hairline: rgba(20, 22, 26, 0.12);
--landing-hairline-strong: rgba(20, 22, 26, 0.24);

/* Real App Dark Cockpit Panels */
--panel-bg: #0B0D10;
--panel-surface: #111419;
--panel-raised: #171B22;
--panel-text: #E8EAED;
--panel-text-secondary: #9AA0A6;
--panel-border: rgba(255, 255, 255, 0.08);

/* Singularity Accent */
--landing-accent: #8AB4F8;
--landing-accent-highlighter: rgba(138, 180, 248, 0.35);
--landing-accent-tint: rgba(138, 180, 248, 0.12);
--landing-accent-border: rgba(138, 180, 248, 0.35);
```

### Typography: Google Sans Flex & Google Sans Code
- **Display & Body Font:** `'Google Sans Flex Variable'`, system-ui, sans-serif.
  - Variable axes verified: `wght` (100–1000), `wdth` (25–151).
  - Used for Display (72px–112px desktop), section headings, and editorial body.
  - No serif anywhere, no mono uppercase micro-labels.
- **Code & Line Gutter Font:** `'Google Sans Code Variable'`, monospace.
  - Variable axes verified: `wght` (300–800).
  - Used strictly for line-number gutter, code citations, and source viewer lines.

### Signature Scroll Motif: Fixed Left Line-Number Gutter
- A fixed vertical strip along the left viewport (width 48px).
- Renders ~60 fixed DOM rows (`001` through `060`).
- Translates smoothly with window scroll via `useScroll` and `useTransform`.
- As the user scrolls into each section, the active line number switches to active state with a glowing `#8AB4F8` indicator and bolder weight.
- Hidden on mobile (`hidden lg:flex`).

---

## 4. AUTH FLOW, DEV LOGIN & FINDINGS AUDIT

### Backend `/dev-login` Enforcement
- **Location:** [`server/app/api/v1/endpoints/auth.py:65-66`](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/server/app/api/v1/endpoints/auth.py#L65-L66)
- **Code Reality:**
  ```python
  if not getattr(settings, "ENABLE_DEV_LOGIN", False) or settings.ENVIRONMENT != "development":
      return JSONResponse(status_code=403, content={"error": "Dev login disabled or not available in this environment"})
  ```
- **Finding:** The endpoint is strictly rejected with HTTP 403 Forbidden whenever `settings.ENVIRONMENT != "development"` or `settings.ENABLE_DEV_LOGIN` is false.
- **Frontend Gating:** The "Dev Quick Login" button is gated in the UI using `import.meta.env.DEV` so it never renders in production client bundles.

### Frontend Auth Architecture (`AuthContext.tsx` & `auth.ts`)
- **`localStorage` Cleanup:** [`client/src/lib/AuthContext.tsx:8-12`](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/lib/AuthContext.tsx#L8-L12) purges legacy cached users (`localStorage.removeItem('cb_user')`) on initialization to ensure server-side cookie authentication is the sole source of truth.
- **Session Expiry Dispatch:** `registerSessionExpiredHandler(markSessionExpired)` automatically navigates unauthenticated sessions back to `'/'` on 401 API responses.
- **Sign-In Redirection:** `signIn()` executes `window.location.href = buildSignInUrl(API_URL)` which cleans trailing slashes and navigates directly to `/api/v1/auth/github` ([`client/src/lib/auth.ts:29-32`](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/lib/auth.ts#L29-L32)).
- **Scope Limitations:** The GitHub OAuth initiation in [`server/app/services/github.py:27`](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/server/app/services/github.py#L27) requests only `"scope": "user:email"`. Because the `repo` scope is not requested, the access token cannot clone private repositories. The landing page copy must strictly specify **public repositories only**.

---

## 5. SINGLE PRIVACY_FACTS CONSTANT

All privacy disclosures are derived from a single constant [`PRIVACY_FACTS`](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/features/landing/data/privacy.ts):

```typescript
export const PRIVACY_FACTS = [
  {
    topic: "Embeddings Storage",
    detail: "Embeddings and code chunks are stored on our servers in PostgreSQL with the pgvector extension.",
    evidence: "server/app/models/knowledge.py"
  },
  {
    topic: "LLM Processing",
    detail: "When a question is asked, retrieved code chunks are sent to our configured LLM provider to synthesize the answer and citations.",
    evidence: "server/app/services/rag/service.py"
  },
  {
    topic: "Repository Scope",
    detail: "Codebase Intellisense currently indexes public GitHub repositories using read-only requests.",
    evidence: "server/app/services/github.py:27"
  },
  {
    topic: "Credential Security",
    detail: "Authentication tokens are encrypted at rest prior to database storage.",
    evidence: "server/app/core/encryption.py"
  }
] as const;
```
> [!NOTE]
> No tier-specific LLM data-training or telemetry claims are made in the copy until the production tier is officially designated by the deployment team.

---

## 6. REACT BITS INTEGRATION AUDIT

Only exact, verified registry component names from [reactbits.dev](https://reactbits.dev) are used:

| Component Name | Category | Registry Source | Purpose on Landing Page |
| :--- | :--- | :--- | :--- |
| `CountUp` | Text / Animations | `reactbits.dev/components/count-up` | Spring-animated count-up for verified proof numbers (files, symbols, import %). |
| `SpotlightCard` | Cards / Effects | `reactbits.dev/components/spotlight-card` | Cursor-following spotlight border for dark product panels. |
| `TiltedCard` | Cards / Effects | `reactbits.dev/components/tilted-card` | Subtle pointer-driven 3D tilt for the Architecture Scrollytelling map scene. |

*(All non-existent composite names such as `SpotlightTiltCard` are dropped).*

---

## 7. DEPLOYMENT NOTE & FASTEMBED PEAK RSS MEASUREMENT

- **Execution Provider:** ONNX Runtime via DirectML (`DmlExecutionProvider` on DirectX 12 GPU, falling back to `CPUExecutionProvider`).
- **Benchmark Script:** [`scripts/measure_fastembed_rss.py`](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/scripts/measure_fastembed_rss.py)
- **Measurement Target:** Real batch embedding generation of 32 chunks from `fastapi/fastapi` using model `BAAI/bge-base-en-v1.5` (768 dimensions).
- **Measured Results:**
  - Initial Python Process RSS: `94.47 MB`
  - RSS after loading chunk texts: `100.62 MB`
  - RSS after FastEmbed ONNX initialization: `125.09 MB`
  - **Peak Working Set (RSS): 465.17 MB**
- **Deployment Guidance:** Server instances should allocate a minimum of **1.0 GB RAM** per worker process to ensure ample buffer headroom for the FastEmbed ONNX runtime during batch embedding generation.

---

## 8. DEMO ACCESSIBILITY (A11Y) SPECIFICATION

1. **Screen-Reader Politeness:** `aria-live="off"` is set on the streaming token container during animated playback to prevent screen-readers from firing rapid per-token announcements.
2. **Static Text Alternative:** A semantic, fully visible `<article>` containing the complete static text of the answer and citations is rendered immediately in the DOM for screen-readers and assistive tools.
3. **Keyboard Navigation:** Question chips, playback controls (Pause / Replay), and citation badges are fully focusable with visible `#8AB4F8` focus rings and operable via `Enter` / `Space`.
4. **Reduced Motion (`prefers-reduced-motion`):** All typing simulations, streaming delays, and spring drawer transitions are bypassed; the demo loads directly into its finished state.

---

## 9. SEO & METADATA SPECIFICATION

Located in `client/index.html` and managed via dynamic route metadata:
- **Title:** `Codebase Intellisense — Ask the repo. Get the line.`
- **Meta Description:** `Connect a public GitHub repository, ask in plain English, and get answers whose citations open the exact lines of code.`
- **Canonical URL:** `https://codebase-intellisense.dev/` (or current deployment domain)
- **OpenGraph:**
  - `og:title`: `Codebase Intellisense — Ask the repo. Get the line.`
  - `og:description`: `Precise codebase Q&A grounded in AST symbols and verified line-level citations.`
  - `og:type`: `website`
  - `og:image`: `/og-image.png` (Static 1200x630 render of hero + cockpit preview)
- **Twitter Card:** `summary_large_image`
- **Favicon:** Clean vector SVG favicon (`/favicon.svg`) with dark/light mode stroke adaptability.

---

## 10. SECTION LIST (Honest, Strict Order)

1. **Nav:**
   - Brand logo (`Codebase Intellisense`), jump-links to `How it works`, `Proof`, `Privacy`, single primary CTA: `Connect GitHub`.
   - Dev quick login button conditionally rendered only when `import.meta.env.DEV` is true.
   - Note: GitHub repo nav link and MIT notice omitted until repository is publicly published.
2. **Hero:**
   - H1: *"Ask the repo. Get the line."* (Masked word reveal).
   - Subline: *"Connect a public GitHub repository, ask in plain English, and get answers whose citations open the exact lines of code."*
   - One primary CTA: `Connect GitHub`. Secondary link: `See a real answer ↓`.
   - Provenance tag: *"Recorded from [fastapi/fastapi](https://github.com/fastapi/fastapi) @ 69c67a1"*.
3. **Interactive Demo (Centerpiece):**
   - Dark cockpit frame (`#0B0D10` / `#111419`) with 3 verified question chips from `demo.json`.
   - Attribution: *"Demo grounded in fastapi/fastapi (Apache 2.0 License)"*.
   - Plays once on entry with Pause/Replay controls; complete static text exposed to assistive devices.
   - Clicking citation badge `[fastapi/openapi/utils.py:258-378]` slides open pre-tokenized Shiki static source pane with highlighter sweep.
4. **How It Works (Scrollytelling):**
   - 4 chapters on left: Connect (read-only public GitHub) -> Index (Tree-sitter AST & embeddings) -> Ask (hybrid retrieval) -> Map (architecture component extraction).
   - Sticky scene on right with `TiltedCard` 3D perspective effect on architecture graph. Stacks vertically on mobile.
5. **Proof:**
   - Real numbers count-up via `CountUp`: `1,221` Source files analyzed (1,217 Python + 4 JS), `12,499` AST symbols, `99.1%` Internal imports resolved.
   - Transparent disclosure of 244 non-analyzed files (markdown, config, shell).
6. **"What It Won't Do" (Differentiator):**
   - Features the real recorded response to the Starlette internals query where the system declined to answer due to missing repository context.
   - Discloses architecture diagrams are static directory/import approximations.
   - Explains queries are pinned to indexed commit snapshots.
7. **Privacy:**
   - Generated from `PRIVACY_FACTS`.
   - Clearly discloses code chunks are stored on our servers and sent to configured LLMs to synthesize answers.
   - Tokens encrypted at rest.
8. **Final CTA & Footer:**
   - Full-bleed dark section: *"Ground your codebase answers today."*
   - Primary button: `Connect GitHub` with magnetic hover feel.
   - Footer: working anchor links (`#how-it-works`, `#proof`, `#privacy`).

---

## 11. WORKFLOW IMPLEMENTATION PLAN (Remaining on branch `feat/ui-redesign`)

- **Step 1:** Tokens, Fonts (`@fontsource-variable/google-sans-flex`, `@fontsource-variable/google-sans-code`), Layout Grid, Nav, Fixed Line Gutter.
- **Step 2:** Data Capture Pipeline (`scripts/capture-landing-data.ts`) + Data Generation (`demo.json`, `proof.json`) with Shiki build-time pre-tokenization + Hero Section.
- **Step 3:** Interactive Demo Centerpiece with human-verification gate, playback controls, and a11y live region guards.
- **Step 4:** How It Works Scrollytelling & 3D Architecture Scene (`TiltedCard`).
- **Step 5:** Proof Metrics (`CountUp`), "What It Won't Do", Privacy Disclosures (`PRIVACY_FACTS`), Final CTA, Clean Footer.
- **Step 6:** Code-splitting (`React.lazy`), bundle verification (<= 180 KB target), vitest tests, and accessibility audit.
