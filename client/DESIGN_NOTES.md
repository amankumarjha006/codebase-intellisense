# Codebase Intellisense — Frontend Prototype Design Notes

This document provides a comprehensive overview of the design system, architecture, and implementation details for the Codebase Intellisense frontend prototype, built faithfully from all 41 Stitch design screenshots.

---

## 1. Design Tokens & Semantic Architecture

All tokens are defined in [src/index.css](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/index.css) as CSS custom properties under Tailwind CSS v4's `@theme` directive.

### Color Semantics

| Token | Hex / Value | Semantic Role | Rule & Guardrail |
|-------|-------------|---------------|------------------|
| `--color-page` | `#0F0F0E` | Canvas backdrop | Base surface for entire app |
| `--color-surface` | `#161615` | Default card / sidebar | Primary container background |
| `--color-raised` | `#1D1D1B` | Elevated panels & inputs | Hover backgrounds, input fills, dropdowns |
| `--color-border` | `rgba(255, 255, 255, 0.08)` | Standard divider | 1px borders on cards and table rows |
| `--color-border-strong` | `rgba(255, 255, 255, 0.14)` | Hover & active borders | Used on focus rings and elevated dialogs |
| `--color-text` | `#EDEBE6` | Primary foreground | High contrast text, primary buttons |
| `--color-text-secondary` | `#C4C1B9` | Secondary text | Explanations, metadata, descriptions |
| `--color-muted` | `#9A978F` | Tertiary / placeholders | Timestamps, file hints, empty states |
| **`--color-accent`** | **`#8AB4F8`** | **Grounded in Source Truth** | **Strictly reserved for citations, highlighted code lines, verified AST anchors, and Ready status. Never used on primary action buttons or links.** |
| `--color-accent-tint` | `rgba(138, 180, 248, 0.12)` | Citation chip background | Subtle highlight for cited line ranges |
| `--color-error` | `#F87171` | Failures & alerts | Never filled red blocks; text/icon only |
| `--color-warning` | `#FBBF24` | In-progress / indexing | Spinners, progress bars, fallback banners |
| `--color-success` | `#4ADE80` | Verified checks | Success indicators |

### Primary Button Contrast Decision
Following the design specification, the primary button is inverted monochrome: `#EDEBE6` text/bg with `#0F0F0E` page contrast. It does NOT use the `#8AB4F8` accent color, ensuring that the blue accent retains its singular cognitive meaning: **verifiable evidence in source code**.

---

## 2. Typography

- **UI & Headings:** `Google Sans Flex` (via `@fontsource-variable/google-sans-flex`) with tight tracking (`-0.02em`) and standard 1.2 line height for headers.
- **Code & Metadata:** `Google Sans Code` (via `@fontsource-variable/google-sans-code`) with disabled ligatures (`font-feature-settings: 'liga' 0`) for git SHAs, line numbers, and syntax code blocks.

---

## 3. Screen State Coverage (All 41 Screens)

| Screen Name | Implementation File | Key Features & States Represented |
|-------------|---------------------|-----------------------------------|
| `landing_full_page.png` | [LandingPage.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/LandingPage.tsx) | Hero with BlurText headline, interactive code demo window, stepper, guarantees, Dither CTA, footer |
| `landing_feature_block_hover.png` | [SpotlightCard.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/components/ui/SpotlightCard.tsx) | Cursor-following soft light on desktop hover |
| `landing_mobile_menu_open.png` | [LandingPage.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/LandingPage.tsx) | Mobile sheet navigation drawer |
| `landing_signing_in.png` | [StatusPages.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/StatusPages.tsx) | GitHub authentication transition loader |
| `dashboard_populated.png` | [DashboardPage.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/DashboardPage.tsx) | Repository list with Ready, Indexing, Failed, Volume metrics, filters, and quick actions |
| `dashboard_empty_first_sign_in.png` | [DashboardPage.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/DashboardPage.tsx) | Clean empty state with icon and connect CTA |
| `dashboard_loading.png` | [DashboardPage.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/DashboardPage.tsx) | Skeleton shimmer table loader |
| `dashboard_error.png` | [DashboardPage.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/DashboardPage.tsx) | Backend unreachable state with retry action |
| `connect_form.png` | [ConnectDrawer.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/components/repository/ConnectDrawer.tsx) | Spring slide drawer from right, URL input |
| `connect_form_with_errors.png` | [ConnectDrawer.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/components/repository/ConnectDrawer.tsx) | Inline validation for rate limit, duplicate, and invalid formats |
| `connect_index_step.png` | [ConnectDrawer.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/components/repository/ConnectDrawer.tsx) | Branch selection and indexing scope description |
| `connect_indexing_progress.png` | [ConnectDrawer.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/components/repository/ConnectDrawer.tsx) | Multi-stage stepper (Queued → Fetching → Tree-sitter AST → Gemini Embeddings → pgvector) |
| `connect_ready_failed.png` | [ConnectDrawer.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/components/repository/ConnectDrawer.tsx) | Completion result with direct link to repo |
| `repository_ready.png` | [RepositoryOverviewPage.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/RepositoryOverviewPage.tsx) | Overview with commit SHA copy, LOC/AST volume cards, index history table |
| `repository_indexing.png` | [RepositoryOverviewPage.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/RepositoryOverviewPage.tsx) | Live progress bar (64%), active file indicator |
| `repository_failed_with_earlier_version.png` | [RepositoryHeader.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/components/repository/RepositoryHeader.tsx) | Warning banner indicating query against fallback version with retry button |
| `chat_new_chat.png` | [ChatPage.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/ChatPage.tsx) | Suggested question cards with icons and file hints |
| `chat_conversation.png` | [ChatPage.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/ChatPage.tsx) | User bubble, markdown answer, citation chips, conversation history list |
| `chat_streaming.png` | [ChatPage.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/ChatPage.tsx) | Live streaming tokens with animated accent caret |
| `chat_newer_version_banner.png` | [ChatPage.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/ChatPage.tsx) | Pinned commit notification with switch to latest CTA |
| `chat_repository_not_ready.png` | [ChatPage.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/ChatPage.tsx) | Inline notice when repo is currently being indexed |
| `chat_error_states.png` | [ChatPage.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/ChatPage.tsx) | Rate limit countdown and no-answer retry options |
| `source_panel.png` | [SourcePanel.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/components/chat/SourcePanel.tsx) | Slide-in panel with cited lines highlighted, line numbers, copy, and open full file |
| `code_search_results.png` | [SearchPage.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/SearchPage.tsx) | Filter facets by extension & symbol type, snippet previews with line ranges |
| `file_browser.png` / `code_view.png` | [FilesPage.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/FilesPage.tsx) | Split tree browser, AST anchor badge, line gutters, encoding status bar |
| `architecture_session.png` | [ArchitecturePage.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/ArchitecturePage.tsx) | Outline scroll-spy, topological dataflow diagram, verified sections with citations |
| `architecture_empty.png` | [ArchitecturePage.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/ArchitecturePage.tsx) | Clean empty state with "Synthesize Architecture" CTA |
| `architecture_generating.png` | [ArchitecturePage.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/ArchitecturePage.tsx) | Shimmering section skeletons and stop generation button |
| `sidebar_expanded.png` / `sidebar_collapsed.png` | [Sidebar.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/components/layout/Sidebar.tsx) | Expanded 240px and collapsed 56px icon rail states |
| `user_menu_open.png` | [Sidebar.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/components/layout/Sidebar.tsx) | User profile dropdown with Dashboard, Shortcuts, GitHub, and Sign Out |
| `not_found.png` | [StatusPages.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/StatusPages.tsx) | 404 page |
| `service_unavailable.png` | [StatusPages.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/StatusPages.tsx) | 503 error page |
| `status_access_was_denied.png` | [StatusPages.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/StatusPages.tsx) | Access denied error page |
| `status_sign_in_failed.png` | [StatusPages.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/StatusPages.tsx) | OAuth failed page |
| `status_your_session_expired.png` | [StatusPages.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/StatusPages.tsx) | Session expired page |
| `status_can_t_reach_the_server.png` | [StatusPages.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/pages/StatusPages.tsx) | Server unreachable page |
| `components_controls.png` | [button.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/components/ui/button.tsx), [input.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/components/ui/input.tsx) | Button variants, text inputs, textareas, search inputs |
| `components_feedback.png` | [badge.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/components/ui/badge.tsx), [skeleton.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/components/ui/skeleton.tsx) | StatusChip icons + text, shimmer skeleton loaders |

---

## 4. Interactive Scenario Switcher

To allow effortless evaluation of all states without modifying code or backend databases, a floating prototype switcher pill is located in the bottom-right corner of every screen ([ScenarioSwitcher.tsx](file:///c:/Users/akjha/OneDrive/Documents/MyProjects/codebase-intellisense/client/src/components/ui/ScenarioSwitcher.tsx)):

- **Dashboard:** Toggle between `Populated`, `Empty`, `Loading` (skeleton), and `Server Error`.
- **Repository Overview:** Toggle between `Ready`, `Indexing` (live progress bar), and `Failed with Fallback`.
- **Chat:** Toggle between `Normal`, `Newer Version Banner`, `Error: No Answer`, and `Error: Rate Limited`.
- **Architecture:** Toggle between `Completed`, `Generating`, and `Empty`.
- **Quick Links:** Jump instantly to 404, 503, Signing in, Sign-in failed, Access denied, and Session expired screens.

---

## 5. Keyboard Navigation & Accessibility

- `Cmd + K` or `Ctrl + K` opens the global **Command Palette** (`cmdk`) from anywhere in the app.
- `/` triggers quick search focus.
- `?` opens the **Keyboard Shortcuts Cheatsheet** dialog.
- `Enter` sends the chat message; `Shift + Enter` inserts a newline.
- Full respect for `prefers-reduced-motion: reduce` across motion configurations, animations, and WebGL dithering.
- Visible `2px` focus rings on all interactive elements using `var(--color-accent)`.
