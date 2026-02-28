# CLAUDE.md — QC Monitor Dashboard

> This file provides context for AI assistants working on this project.
> Read this FIRST before making any changes.

## Project Overview

**QC Monitor** is a comprehensive QA test automation monitoring dashboard. It receives test results from Playwright (via a custom SDK reporter), stores them, and provides a web dashboard for QA teams to monitor, analyze, and manage their test automation.

**Key value prop:** One dashboard to monitor QA health across multiple applications and environments, with built-in test case standards (Library), release quality gates (Releases), and role-based access for 6 team roles.

## Repository Structure

```
D:\self_project\dashboard-automation/     ← Monorepo root (Turborepo)
├── apps/
│   ├── api/                              ← Backend API (Fastify)
│   │   ├── src/
│   │   │   ├── routes/                   ← API route handlers
│   │   │   ├── services/                 ← Business logic services
│   │   │   ├── middleware/               ← Auth, permission, JWT middleware
│   │   │   ├── helpers/                  ← Data scoping, utilities
│   │   │   └── scripts/                  ← Seed scripts
│   │   └── package.json
│   └── web/                              ← Frontend (Next.js)
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/               ← Public auth pages (no sidebar)
│       │   │   │   ├── login/
│       │   │   │   ├── accept-invite/
│       │   │   │   ├── change-password/
│       │   │   │   ├── reset-password/
│       │   │   │   └── forgot-password/
│       │   │   └── (dashboard)/          ← Protected pages (with sidebar)
│       │   │       ├── page.tsx          ← Dashboard overview
│       │   │       ├── test-cases/
│       │   │       ├── runs/
│       │   │       ├── retries/
│       │   │       ├── library/          ← Library (3-layer depth)
│       │   │       │   ├── page.tsx                      ← Layer 1: Collections
│       │   │       │   ├── collections/[id]/page.tsx     ← Layer 2: Test case list
│       │   │       │   └── test-cases/[id]/page.tsx      ← Layer 3: Test case detail
│       │   │       ├── releases/         ← Releases (2-layer depth)
│       │   │       │   ├── page.tsx                      ← Layer 1: Release list
│       │   │       │   └── [id]/page.tsx                 ← Layer 2: Release detail
│       │   │       ├── users/
│       │   │       ├── api-keys/
│       │   │       ├── activity/
│       │   │       ├── settings/
│       │   │       └── profile/
│       │   ├── components/
│       │   │   ├── ui/                   ← Reusable UI components (shadcn + custom)
│       │   │   │   ├── toast-system.tsx
│       │   │   │   ├── inline-edit.tsx
│       │   │   │   ├── validated-input.tsx
│       │   │   │   ├── validated-textarea.tsx
│       │   │   │   ├── form-field.tsx
│       │   │   │   ├── tag-input.tsx
│       │   │   │   ├── smart-button.tsx
│       │   │   │   ├── confirm-dialog.tsx
│       │   │   │   ├── emoji-picker.tsx
│       │   │   │   ├── step-indicator.tsx
│       │   │   │   └── keyboard-hint.tsx
│       │   │   ├── skeletons/            ← Skeleton loaders per page
│       │   │   ├── Sidebar.tsx           ← 2-level accordion sidebar
│       │   │   ├── NotificationBell.tsx
│       │   │   └── ProtectedRoute.tsx
│       │   ├── providers/
│       │   │   ├── AuthProvider.tsx
│       │   │   └── ToastProvider.tsx
│       │   ├── hooks/
│       │   │   ├── useToast.ts
│       │   │   └── useKeyboardShortcut.ts
│       │   └── lib/
│       │       └── api.ts                ← API client with all endpoints
│       └── package.json
├── packages/
│   ├── db/                               ← Prisma schema + client
│   │   ├── prisma/
│   │   │   └── schema.prisma             ← All database models
│   │   └── package.json
│   └── sdk/                              ← Published NPM package
│       └── package.json                  ← @bagasfd09/qc-monitor-reporter
├── tests/
│   └── integration/
│       ├── setup.ts                      ← Creates teams + API keys
│       └── sample-tests/                 ← Playwright tests that report to dashboard
├── turbo.json
├── package.json
└── CLAUDE.md                             ← You are here
```

**Related repo:**
```
D:\self_project\template-test/            ← Template for teams to clone
```

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Monorepo | Turborepo | Workspace: pnpm |
| Backend | Fastify | REST API |
| Database | PostgreSQL | Via Prisma ORM |
| Cache | Redis | Query caching (30-60s TTL) |
| File Storage | MinIO | Screenshots, videos, traces from test runs |
| Real-time | WebSocket | Live updates on dashboard (runs, notifications, releases) |
| Frontend | Next.js (App Router) | Route groups: (auth) and (dashboard) |
| UI Components | shadcn/ui + Tailwind CSS | Custom components in src/components/ui/ |
| Auth | JWT (access + refresh) | Access: 15min memory-only, Refresh: 7-day httpOnly cookie |
| SDK | @bagasfd09/qc-monitor-reporter | Published to GitHub Packages |

## Database Schema (Key Models)

### Core Testing Models
- **Team** — organizational unit, has members, API keys, collections, releases
- **TestRun** — a single Playwright execution (has status, duration, pass/fail counts)
- **TestCase** — individual test case synced from SDK (belongs to team, has suite name)
- **TestResult** — result of a test case in a specific run (PASSED/FAILED/SKIPPED)
- **Artifact** — screenshots, videos, traces attached to test results (stored in MinIO)

### Auth Models
- **User** — email/password auth, one of 6 roles, can belong to multiple teams
- **TeamMember** — join table: User ↔ Team
- **RefreshToken** — stored in DB, httpOnly cookie, 7-day expiry, token rotation
- **Invite** — invite-only registration, 7-day expiry token
- **PasswordReset** — admin-generated reset links, 1-hour expiry
- **ActivityLog** — audit trail for all state-changing operations

### Library Models (Test Case Standards)
- **LibraryCollection** — group of standard test cases by module (e.g. "Payment", "Auth")
- **LibraryTestCase** — standard/reference test case with steps, criteria, priority, tags
- **LibraryTestCaseVersion** — version history, every edit creates a new version
- **LibraryDependency** — prerequisite relationships between library test cases
- **LibrarySuggestion** — member suggestions for updates (PENDING → APPROVED/REJECTED)
- **LibraryDiscussion** — threaded comments on test cases
- **LibraryBookmark** — user bookmarks for frequently referenced tests

### Release Models (Quality Gates)
- **Release** — per-release checklist (ACTIVE → RELEASED/CANCELLED)
- **ReleaseChecklistItem** — AUTOMATED (linked to library + actual test) or MANUAL (checkbox)

### Notification Models
- **Notification** — in-app notifications with type, read status
- **NotificationPreference** — per-user, per-type toggle (inApp, email)

### Enums
```
UserRole: ADMIN, MANAGER, SUPERVISOR, TEAM_LEAD, MEMBER, MONITORING
TestPriority: P0 (Critical), P1 (High), P2 (Medium), P3 (Low)
TestDifficulty: EASY, MEDIUM, HARD
LibraryTestCaseStatus: DRAFT, ACTIVE, DEPRECATED, ARCHIVED
ReleaseStatus: ACTIVE, RELEASED, CANCELLED
ChecklistItemType: AUTOMATED, MANUAL
ChecklistItemStatus: PASSED, FAILED, NOT_RUN, SKIPPED, CHECKED, UNCHECKED
```

## Authentication & Authorization

### Auth Flow
1. Admin creates system via seed script → gets default admin credentials
2. Admin invites users via email → user receives invite link
3. User accepts invite → sets name + password → auto-logged in
4. JWT access token (15min, memory) + refresh token (7-day, httpOnly cookie)
5. Auto-refresh at 14-min mark, token rotation on refresh
6. `credentials: 'include'` on ALL frontend fetch calls

### 6 Roles & Data Scoping

| Role | Data Scope | Key Permissions |
|------|-----------|----------------|
| ADMIN | ALL_TEAMS | Full access, manage everything, system settings |
| MANAGER | ALL_TEAMS | Manage users (lower roles), view all, trigger retries |
| SUPERVISOR | ALL_TEAMS | Read-only across all teams, activity log |
| TEAM_LEAD | OWN_TEAMS | Manage own team's library, releases, members, retries |
| MEMBER | OWN_TEAMS | Run tests, retry, suggest updates, discuss, bookmark |
| MONITORING | ASSIGNED_TEAMS | Read-only on assigned teams |

### Permission Middleware
- `requireAuth()` — verify JWT
- `requireRole(...roles)` — check user role
- `requirePermission(permission)` — check specific capability
- `requireTeamAccess(teamId)` — check user can access this team's data
- `scopedTeamFilter(user)` — Prisma where clause based on role

## API Route Structure

### SDK Routes (API key auth via `x-api-key` header)
```
POST /api/test-cases      ← SDK syncs test cases
POST /api/runs            ← SDK creates/updates runs
POST /api/results         ← SDK sends test results
POST /api/artifacts       ← SDK uploads screenshots/videos
POST /api/retry           ← Retry trigger (also used by dashboard)
```

### Admin Dashboard Routes (JWT auth via `Bearer` token)
```
/api/auth/*               ← Login, refresh, logout, invite, password reset
/api/admin/overview       ← Dashboard stats
/api/admin/teams/*        ← Team CRUD + members + API keys
/api/admin/test-cases/*   ← Test case listing, grouping, detail
/api/admin/runs/*         ← Test runs listing, detail, grouped results
/api/admin/users/*        ← User management, invites
/api/admin/library/*      ← Library collections, test cases, versions, suggestions, discussions, coverage
/api/admin/releases/*     ← Releases, checklist items, stats, history
/api/notifications/*      ← Notification CRUD + preferences
/api/admin/activity-log   ← Activity audit trail
```

## Frontend Patterns

### Component Conventions
- All pages use **skeleton loaders** that match exact layout dimensions (no layout shift)
- Data fetching via **React Query** with staleTime/gcTime configured per data type
- **Parallel fetching** — dashboard sections load independently
- **Prefetching** — hover on sidebar/table rows prefetches detail data
- **Progressive loading** — each section shows its own skeleton independently

### Global UX Components (src/components/ui/)
These are custom components built on top of shadcn/ui. Always use these instead of raw HTML:

| Component | Usage |
|-----------|-------|
| `SmartButton` | ALL submit buttons — has loading/success/error states, disabledReason tooltip |
| `ValidatedInput` | Text inputs with inline validation (valid/warning/error states) |
| `ValidatedTextarea` | Auto-grow textarea with validation, optional character count |
| `FormField` | Wrapper for consistent label + input + hint/error layout |
| `TagInput` | Multi-value chip input with suggestions and frequency counts |
| `InlineEdit` | Click-to-edit text with save/cancel, used for titles/names |
| `ConfirmDialog` | Destructive action confirmations, supports type-to-confirm |
| `EmojiPicker` | Lightweight curated emoji grid for collection icons |
| `StepIndicator` | Multi-step flow progress (dots/numbers/progress variants) |
| `KeyboardHint` | Shows keyboard shortcut hints (auto-detects Mac/Windows) |
| `useToast()` | Toast notifications with undo/retry/action support |
| `useKeyboardShortcut()` | Keyboard shortcut registration with conditional activation |
| `SourceBadge` | Run source indicator — LOCAL/CI/MANUAL with colored icon+label (Prompt G1) |
| `EnvBadge` | Environment badge — local/staging/production with color coding (Prompt G1) |
| `StatusBar` | Proportional pass/fail/skip bar with configurable height (Prompt G1) |
| `MiniSparkline` | Tiny SVG trend line for inline metrics (Prompt G1) |
| `HistoryDots` | Recent 8-run history as colored bars showing stability pattern (Prompt G1) |
| `FilterChip` | Clickable filter toggle with count badge (Prompt G1) |
| `TestCaseRow` | Reusable test case row with status, badges, history, duration (Prompt G2) |

### Form Design Principles
1. **Progressive disclosure** — show essential fields first, collapse optional sections
2. **Smart defaults** — pre-fill based on context (team, last used values, etc.)
3. **Inline everything** — prefer inline creation over separate modal/pages when possible
4. **Validate as you type** — instant feedback, never surprise on submit
5. **Keyboard-first** — Tab flow, Enter to submit, Escape to cancel, Cmd+Enter for multi-field forms
6. **Toast + Undo** — non-destructive actions use toast with 5s undo window
7. **Confirm only for destructive** — only show confirmation dialogs for irreversible actions

### Sidebar (2-Level Accordion)
- Grouped sections: OVERVIEW, TESTING, LIBRARY, RELEASES, MANAGEMENT, SYSTEM
- Collapsible with saved state per user (localStorage)
- Role-based visibility — groups/items hidden based on user role
- Responsive: full sidebar → icon-only → hamburger overlay

### Theme
- Dark + Light mode via `next-themes` with class strategy
- CSS variables in globals.css for `:root` (light) and `.dark` (dark)
- Light: blue primary (#3b82f6), white backgrounds
- Dark: purple primary (#818cf8), very dark backgrounds (#0a0a0f)
- 200ms transition on theme switch
- Default: system preference, persisted after manual choice

## SDK (@bagasfd09/qc-monitor-reporter)

Published to GitHub Packages. Teams install and configure in their Playwright config:

```typescript
import { QCMonitorReporter } from "@bagasfd09/qc-monitor-reporter";

export default defineConfig({
  reporter: [
    ['list'],
    [QCMonitorReporter, {
      apiKey: "sk-qcm-xxx",
      application: "nexchief",      // registered app slug
      environment: "staging",        // registered environment
    }],
  ],
});
```

The SDK:
- Syncs test cases (title, suite name, file path)
- Creates test runs (start/finish, status, duration)
- Sends test results (pass/fail/skip per test)
- Uploads artifacts (screenshots, videos, traces to MinIO via API)

## Key Features & Status

### ✅ Completed
- **Backend API** — Fastify + Prisma + PostgreSQL + Redis + MinIO + WebSocket
- **SDK Reporter** — published to GitHub Packages
- **Frontend Dashboard** — Next.js + shadcn/ui
- **Authentication** — JWT, 6 roles, invite-only registration
- **User Management** — invite, edit roles, deactivate, password reset
- **Test Cases** — listing, grouping by suite, detail with artifacts (REDESIGN planned: Prompt G2)
- **Test Runs** — listing, detail with grouped results, status tracking (REDESIGN planned: Prompt G1)
- **Retries** — retry failed tests from dashboard, watcher system
- **Library** — 3-layer depth (collections → test cases → detail with tabs)
  - Versioning + rollback
  - Suggestions (member → Team Lead review)
  - Discussions (threaded comments)
  - Bookmarks
  - Coverage dashboard + gap alerts
  - Import from member runs
  - Code template generation
- **Releases** — 2-layer depth (list → detail with checklist)
  - Automated items (linked to library + actual tests, auto-updated from runs)
  - Manual checks (checkbox items)
  - Mark as Released / Force Release / Cancel
  - Release history + stats
- **Sidebar** — 2-level accordion, role-based visibility, team switcher
- **Notifications** — in-app bell, WebSocket real-time, preferences
- **Activity Logging** — full audit trail
- **Dark/Light Mode** — system preference + manual toggle
- **Skeleton Loaders** — every page, matching exact layout
- **Performance** — Redis caching, DB indexes, parallel queries, prefetching
- **UX Components** — toast+undo, inline edit, validated inputs, smart buttons, tag input, confirm dialog, keyboard shortcuts
- **Form UX** — progressive disclosure, smart defaults, inline creation, visual role/priority selectors
- **Integration Tests** — sample Playwright tests with suite structure

### 🔜 Next Up
- **Test Runs/Cases UX Redesign** (Prompts G1, G2) — new micro-components (SourceBadge, EnvBadge, StatusBar, MiniSparkline, HistoryDots, FilterChip), summary cards, expandable run cards with inline error preview, suite accordion with flaky/library badges, test case detail with 4 tabs (Error/Steps/Artifacts/Console), smart error hints, URL state persistence, run history visualization
- **Application + Environment** — multi-app support (NexChief, NexMile, ND6), environment tracking (dev/staging/prod), app context switcher, cross-environment comparison, smart insights
- **My Tasks** (Personal Work Board) — task groups with branch tracking, auto-match test results to tasks, dual tracking (local vs staging), Team Lead assignment, Task Progress page
- **Run Source Tracking** — LOCAL/CI/MANUAL source enum, branch auto-detection in SDK, cross-member task updates from staging runs
- **Analytics & Trends** — pass rate trends, team comparison, charts
- **Flaky Test Detection** — auto-detect intermittent failures, flakiness score
- **Command Palette** — Cmd+K power navigation

## Performance Optimizations Applied
- Redis caching on expensive queries (overview, teams, test-cases grouped) with 30-60s TTL
- Prisma indexes on all frequently queried fields
- `select` (not `include`) on list endpoints — only fetch needed fields
- `Promise.all()` for parallel DB queries
- React Query staleTime/gcTime configured per data type
- Prefetch on sidebar hover + pagination hover + table row hover
- Skeleton loaders prevent layout shift
- `@fastify/compress` for gzip response compression
- Cursor-based pagination for large datasets (inner pagination, activity log)

## Common Patterns

### Adding a New API Route
1. Create route handler in `apps/api/src/routes/`
2. Add auth middleware: `requireAuth()` + `requireRole(...)` or `requirePermission(...)`
3. Apply data scoping: `scopedTeamFilter(request.user)`
4. Log activity: `logActivity(userId, 'action.name', teamId, details)`
5. Invalidate relevant Redis cache keys
6. Send WebSocket events if real-time update needed
7. Create notifications if user should be notified

### Adding a New Frontend Page
1. Create page in `apps/web/src/app/(dashboard)/`
2. Add API client methods in `src/lib/api.ts`
3. Create skeleton component in `src/components/skeletons/`
4. Use React Query for data fetching (parallel where possible)
5. Wrap data sections with skeleton/loaded pattern
6. Add route to sidebar with proper role visibility
7. Add route protection with required permission
8. Support dark/light mode (use CSS variables, not hardcoded colors)
9. Use global UX components (SmartButton, ValidatedInput, etc.)

### Adding a New Form
1. Use `ValidatedInput` / `ValidatedTextarea` / `FormField` wrappers
2. Use `SmartButton` for submit (auto loading/success states)
3. Apply progressive disclosure — collapse optional sections
4. Pre-fill smart defaults based on context
5. Inline validation on blur/change
6. Keyboard support: Tab, Enter, Escape, Cmd+Enter
7. Toast feedback with undo for non-destructive actions
8. ConfirmDialog for destructive actions
9. Auto-focus first input on open

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/qc_monitor?connection_limit=20&pool_timeout=10

# Redis
REDIS_URL=redis://localhost:6379

# MinIO (File Storage)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=qc-monitor

# Auth
JWT_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars

# Admin Seed
DEFAULT_ADMIN_EMAIL=admin@qc-monitor.com
DEFAULT_ADMIN_NAME=System Admin

# Frontend
FRONTEND_URL=http://localhost:3000

# API
API_URL=http://localhost:3001
```

## Scripts

```bash
pnpm install                    # Install all dependencies
pnpm dev                        # Start all apps (Turborepo)
pnpm db:push                    # Push Prisma schema to DB
pnpm db:seed                    # Create default admin user
pnpm test:integration           # Run setup + all integration tests
pnpm test:integration:flows     # Run only flow tests
pnpm test:integration:menus     # Run only menu tests
pnpm test:integration:smoke     # Run only smoke tests
```

## Important Conventions

1. **Never use `localStorage` for access tokens** — memory only (useState)
2. **Always use `credentials: 'include'`** on all fetch calls
3. **Always scope data by role** — never return data a user shouldn't see
4. **Always log activity** for state-changing operations
5. **Always invalidate Redis cache** when data changes
6. **Always use shadcn/ui + custom UX components** — never raw HTML inputs
7. **Always add skeletons** for new pages matching exact layout
8. **Always support dark mode** — use CSS variables, not hardcoded colors
9. **Keep SDK routes unchanged** — SDK auth uses x-api-key, dashboard uses JWT
10. **Test case titles from SDK are case-sensitive** — fuzzy matching for library linking
