# QC Monitor

A full-stack test automation monitoring platform. Connect your Playwright test suite via a lightweight reporter package, stream live results to a central dashboard, and store screenshots, videos, and traces in object storage — all in one place.

---

## Key Features

- **Playwright Reporter SDK** — Drop-in reporter (`@bagasfd09/qc-monitor-reporter`) that auto-syncs test cases, streams results, and uploads artifacts on failure
- **Real-time Dashboard** — Next.js admin UI showing live run progress via WebSocket, with per-team and cross-team views
- **Multi-team Support** — Each QA team gets an isolated API key; the admin layer gives a unified view across all teams
- **Artifact Storage** — Screenshots, videos, and Playwright traces are uploaded to MinIO (S3-compatible) and served via presigned URLs
- **WebSocket Live Updates** — Events streamed as tests run: `run:started`, `result:new`, `result:failed`, `run:finished`
- **Redis Fan-out (optional)** — Horizontal scaling support via Redis pub/sub for multi-instance deployments
- **Admin Access Layer** — Separate admin key for cross-team aggregated stats, top failing tests, and recent activity
- **Zero-impact Reporter** — All API calls fail silently with exponential backoff retries; your test run never fails because of the reporter

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     QC Monitor Platform                     │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   apps/web   │    │   apps/api   │    │  packages/   │  │
│  │  Next.js 14  │◄──►│  Fastify v5  │◄──►│     db       │  │
│  │  Port 3000   │    │  Port 3001   │    │   Prisma 5   │  │
│  └──────────────┘    └──────┬───────┘    └──────────────┘  │
│                             │                               │
│                    ┌────────┼────────┐                      │
│                    ▼        ▼        ▼                      │
│               PostgreSQL  MinIO   Redis                     │
│               Port 5044  :9000   :6379                      │
└─────────────────────────────────────────────────────────────┘
                             ▲
                             │ HTTP + WebSocket
              ┌──────────────┴──────────────┐
              │  packages/reporter           │
              │  @bagasfd09/qc-monitor-      │
              │  reporter (Playwright SDK)   │
              └─────────────────────────────┘
```

**Monorepo layout:**

```
dashboard-automation/
├── apps/
│   ├── api/              # Fastify v5 REST + WebSocket API
│   └── web/              # Next.js 14 admin dashboard
├── packages/
│   ├── db/               # Prisma schema + generated client
│   ├── reporter/         # Playwright reporter npm package
│   └── shared/           # Shared constants & TypeScript types
├── tests/                # Integration tests
├── docker-compose.yml    # Local infrastructure (Postgres, MinIO, Redis)
├── turbo.json            # Turborepo build pipeline
└── pnpm-workspace.yaml
```

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ≥ 18 | Runtime |
| pnpm | ≥ 9 | Package manager |
| Docker + Docker Compose | any recent | Local infrastructure |

Install pnpm if you don't have it:

```bash
npm install -g pnpm
```

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/bagasfd09/dashboard-automation.git
cd dashboard-automation
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and set the following (defaults work for local Docker):

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5044/qcmonitor

# Redis (optional — enables multi-instance WebSocket fan-out)
REDIS_URL=redis://localhost:6379

# MinIO object storage
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=artifacts

# API server
PORT=3001
NODE_ENV=development

# Admin key (generate one in Step 6)
ADMIN_SECRET_KEY=
```

Also create the web environment file:

```bash
cp apps/web/.env.example apps/web/.env.local
```

```env
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_ADMIN_KEY=        # same value as ADMIN_SECRET_KEY above
```

### 4. Start infrastructure

```bash
docker compose up -d
```

This starts:
- **PostgreSQL** on port `5044` — main database
- **MinIO** on port `9000` (API) and `9001` (web console) — artifact storage
- **Redis** on port `6379` — optional pub/sub for WebSocket fan-out

Verify all services are healthy:

```bash
docker compose ps
```

### 5. Set up the database

Generate the Prisma client and push the schema:

```bash
pnpm db:generate
pnpm db:push
```

### 6. Generate the admin key

```bash
pnpm --filter @qc-monitor/api admin:seed
```

This generates a secure 64-character hex key, writes it to `apps/api/.env` as `ADMIN_SECRET_KEY`, and prints it to the console. Copy the value into:
- `apps/api/.env` → `ADMIN_SECRET_KEY=`
- `apps/web/.env.local` → `NEXT_PUBLIC_ADMIN_KEY=`

### 7. Start the development servers

```bash
pnpm dev
```

This runs both the API and the web dashboard in parallel via Turborepo:

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:3000 |
| API | http://localhost:3001 |
| MinIO Console | http://localhost:9001 (user: `minioadmin` / pass: `minioadmin`) |

---

## Creating Your First Team

The API is now running. Create a team to get an API key for your test suite:

```bash
curl -X POST http://localhost:3001/api/teams \
  -H "Content-Type: application/json" \
  -d '{"name": "My QA Team"}'
```

Response:

```json
{
  "id": "cm1abc...",
  "name": "My QA Team",
  "apiKey": "cm1xyz...",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

Save the `apiKey` — you'll need it to configure the reporter.

---

## Connecting the Playwright Reporter

### Install

The reporter is published to GitHub Packages. See [`packages/reporter/README.md`](packages/reporter/README.md) for full installation instructions including PAT setup.

```bash
npm install @bagasfd09/qc-monitor-reporter
```

### Configure

Add to your `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['list'],
    ['@bagasfd09/qc-monitor-reporter/playwright', {
      apiUrl: process.env.QC_MONITOR_API_URL || 'http://localhost:3001',
      apiKey: process.env.QC_MONITOR_API_KEY,
    }],
  ],
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
});
```

Set your environment variables:

```env
QC_MONITOR_API_URL=http://localhost:3001
QC_MONITOR_API_KEY=cm1xyz...   # the apiKey from POST /api/teams
```

### Run tests

```bash
npx playwright test
```

On completion you'll see:

```
✅ QC Monitor: Results reported. Run ID: cm1run001 (42 passed, 1 failed, 3 skipped)
```

Results, artifacts, and live status will appear in the dashboard immediately.

---

## Dashboard Pages

| Page | URL | Description |
|------|-----|-------------|
| Overview | `/` | Global stats, run status breakdown, teams summary, recent activity |
| Teams | `/teams` | All teams with pass rate and last run status |
| Team detail | `/teams/[teamId]` | Per-team stats, top failing tests, recent runs |
| Runs | `/runs` | All test runs across teams, filterable by team |
| Run detail | `/runs/[id]` | Full results table, pass/fail bar, error details, artifacts |
| Test Cases | `/test-cases` | All synced test cases, filterable by team and tag |

---

## Real-time WebSocket

The API broadcasts live events over WebSocket.

**Team connection:**
```
ws://localhost:3001/ws?apiKey=cm1xyz...
```

**Admin connection (all teams):**
```
ws://localhost:3001/ws?adminKey=<ADMIN_SECRET_KEY>
```

**Events:**

| Event | When |
|-------|------|
| `connected` | On successful connection |
| `run:started` | A new test run begins |
| `result:new` | A test result is reported |
| `result:failed` | A test fails |
| `run:finished` | A run completes |
| `artifact:new` | An artifact is uploaded |

Each event has the shape:

```json
{
  "event": "result:failed",
  "data": { "testCaseTitle": "...", "error": "...", "teamName": "..." },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Keepalive: send `{ "type": "ping" }` → server replies `{ "type": "pong", "timestamp": "..." }`.

---

## API Reference

All routes require the `x-api-key` header unless noted otherwise.

### Teams

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/teams` | None | Create a new team |

### Test Cases

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/test-cases` | List test cases (paginated) |
| GET | `/api/test-cases/:id` | Get test case detail |
| POST | `/api/test-cases/sync` | Upsert test cases (used by reporter) |

### Runs

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/runs` | Start a new test run |
| PATCH | `/api/runs/:id` | Update run status and duration |
| GET | `/api/runs` | List runs (paginated) |
| GET | `/api/runs/:id` | Get run detail with results |

### Results

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/results` | Report a test result |
| PATCH | `/api/results/:id` | Update result status/error |

### Artifacts

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/artifacts/upload` | Upload file (multipart) |
| GET | `/api/artifacts/:id/download` | Get presigned download URL |

### Admin (requires `x-admin-key` header)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/overview` | Global stats across all teams |
| GET | `/api/admin/teams` | All teams with stats |
| GET | `/api/admin/teams/:teamId/stats` | Detailed team stats |
| GET | `/api/admin/runs` | All runs (filter by `?teamId=`) |
| GET | `/api/admin/runs/:id` | Run detail (no team scope) |
| GET | `/api/admin/test-cases` | All test cases (filter by `?teamId=`) |
| GET | `/api/admin/artifacts/:id/download` | Presigned URL (no team scope) |

---

## Environment Variables Reference

### `apps/api/.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `PORT` | No | `3001` | API server port |
| `NODE_ENV` | No | `development` | Node environment |
| `ADMIN_SECRET_KEY` | Yes | — | 64-char hex key for admin access (generate via `admin:seed`) |
| `MINIO_ENDPOINT` | Yes | — | MinIO host:port (e.g. `localhost:9000`) |
| `MINIO_ACCESS_KEY` | Yes | — | MinIO access key |
| `MINIO_SECRET_KEY` | Yes | — | MinIO secret key |
| `MINIO_USE_SSL` | No | `false` | Set `true` for production MinIO over HTTPS |
| `REDIS_URL` | No | — | Redis connection string — enables multi-instance pub/sub |
| `DISABLE_AUTH` | No | — | Set `true` to skip API key auth (development only) |

### `apps/web/.env.local`

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Full URL of the API (e.g. `http://localhost:3001`) |
| `NEXT_PUBLIC_ADMIN_KEY` | Yes | Same value as `ADMIN_SECRET_KEY` in the API |

---

## Scripts Reference

Run from the monorepo root:

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start API + web in dev mode (hot reload) |
| `pnpm build` | Build all packages and apps |
| `pnpm db:generate` | Regenerate Prisma client after schema changes |
| `pnpm db:push` | Push schema changes to the database |
| `pnpm publish:reporter` | Build and publish the reporter to GitHub Packages |
| `pnpm --filter @qc-monitor/api admin:seed` | Generate and save a new admin key |

---

## Production Notes

- Set `NODE_ENV=production` and `MINIO_USE_SSL=true` in production
- Use a reverse proxy (nginx, Caddy) in front of both the API and web app
- Store `ADMIN_SECRET_KEY` in a secrets manager — never commit it
- Redis is optional locally but recommended for production multi-instance deployments
- MinIO can be replaced with AWS S3 or any S3-compatible service by updating the endpoint and credentials

---

## License

MIT
