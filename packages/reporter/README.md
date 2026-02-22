# @bagasfd09/qc-monitor-reporter

Playwright reporter for [QC Monitor](https://github.com/bagasfd09/dashboard-automation). Automatically syncs test cases (including `test.describe()` suite hierarchy), streams live results, uploads screenshots / videos / traces to your dashboard, and provides a watcher CLI for retrying failed tests on demand.

## Requirements

- Node.js ≥ 18
- Playwright ≥ 1.40
- A running QC Monitor API (see `apps/api`)

---

## Installation (GitHub Packages)

This package is published to GitHub Packages. You need a GitHub Personal Access Token (PAT) with `read:packages` scope to install it.

### Step 1 — Create a PAT

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Click **Generate new token (classic)**
3. Give it a name (e.g. `qc-monitor-install`) and tick **`read:packages`**
4. Copy the generated token

### Step 2 — Add `.npmrc` to your project

Create a `.npmrc` file in your project root (next to `package.json`):

```
@bagasfd09:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then set the `GITHUB_TOKEN` environment variable to your PAT:

```bash
# .env or shell profile
GITHUB_TOKEN=ghp_your_token_here
```

> **Tip for CI (GitHub Actions):** `GITHUB_TOKEN` is automatically available in workflow runs — no extra setup needed.

### Step 3 — Install the package

```bash
npm install @bagasfd09/qc-monitor-reporter
# or
pnpm add @bagasfd09/qc-monitor-reporter
# or
yarn add @bagasfd09/qc-monitor-reporter
```

---

## Quick setup

### 1. Create a team and grab the API key

```bash
curl -X POST http://localhost:3001/api/teams \
  -H "Content-Type: application/json" \
  -d '{"name": "My QA Team"}'
# → { "id": "...", "apiKey": "cld_abc123...", ... }
```

### 2. Add config (pick one approach)

**Option A — config file** (`qc-monitor.config.js` in your project root):

```js
// qc-monitor.config.js
export default {
  apiUrl: 'http://localhost:3001',
  apiKey: 'cld_abc123...',
  captureScreenshot: true,
  captureVideo: true,
  captureTrace: true,
};
```

**Option B — environment variables** (CI-friendly):

```bash
QC_MONITOR_API_URL=http://localhost:3001
QC_MONITOR_API_KEY=cld_abc123...
```

**Option C — inline in `playwright.config.ts`** (highest priority, overrides file + env):

```ts
reporter: [
  ['@bagasfd09/qc-monitor-reporter/playwright', {
    apiUrl: 'http://localhost:3001',
    apiKey: 'cld_abc123...',
  }],
]
```

### 3. Add the reporter to `playwright.config.ts`

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['list'],                              // keep the default console output
    ['@bagasfd09/qc-monitor-reporter/playwright'],   // add QC Monitor
  ],

  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
});
```

### 4. Run your tests

```bash
npx playwright test
```

On completion you'll see:

```
✅ QC Monitor: Results reported. Run ID: cm1run001 (42 passed, 1 failed, 3 skipped)
```

---

## Configuration reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | `string` | — | Base URL of the QC Monitor API |
| `apiKey` | `string` | — | Team API key from `POST /api/teams` |
| `teamName` | `string` | — | Informational label (not sent to API) |
| `retries` | `number` | `2` | Network retry attempts with exponential backoff |
| `captureScreenshot` | `boolean` | `true` | Upload screenshots on failure |
| `captureVideo` | `boolean` | `true` | Upload videos on failure |
| `captureTrace` | `boolean` | `true` | Upload Playwright traces on failure |

Config priority (highest → lowest): **inline options → env vars → config file → defaults**

---

## How it works

| Lifecycle hook | What happens |
|---|---|
| `onBegin` | Collects all test titles, file paths, and `test.describe()` suite names. Calls `POST /api/test-cases/sync` (idempotent upsert, saves `suiteName`), then `POST /api/runs` to start a new run — both in parallel |
| `onTestEnd` | Maps Playwright status → `PASSED / FAILED / SKIPPED`, calls `POST /api/results`. On failure also uploads screenshots, videos, and traces via `POST /api/artifacts/upload` |
| `onEnd` | Calls `PATCH /api/runs/:id` to mark the run finished with final counts and duration |

All API calls fail silently with a `console.warn` — they never cause your test run to fail.

### Suite name capture

The reporter walks each test's `parent` chain to collect `test.describe()` block titles and joins them with ` > `. For example:

```ts
test.describe('Auth', () => {
  test.describe('Login', () => {
    test('should log in with valid credentials', async ({ page }) => { ... });
  });
});
```

This test is synced with `suiteName: "Auth > Login"`. Tests without any describe block have `suiteName: null` and appear under `(no suite)` in the grouped dashboard view.

---

## Retry Watcher

The retry watcher is a long-lived CLI process that polls the API for PENDING retry requests (queued from the dashboard) and triggers Playwright to re-run the affected test.

### Starting the watcher

```bash
# via the package bin
npx qc-monitor-watch

# or via a package.json script (recommended)
# package.json: "watch": "npx qc-monitor-watch"
npm run watch
```

The watcher reads the same `qc-monitor.config.js` / environment variables as the reporter — no extra configuration is needed.

### What it does

```
1. Every 30 seconds: GET /api/retry/pending
2. For each PENDING request:
   a. PATCH /api/retry/:id  { status: "RUNNING" }
   b. npx playwright test --grep "<test title>" --retries 0
   c. PATCH /api/retry/:id  { status: "COMPLETED" }
3. The new result appears in the dashboard automatically via WebSocket
```

Requests not picked up within **10 minutes** are automatically expired by the API.

### Watcher status flow

| Status | Meaning |
|--------|---------|
| `PENDING` | Queued from the dashboard, not yet picked up |
| `RUNNING` | Watcher has started the Playwright process |
| `COMPLETED` | Playwright finished — check Test Runs for the result |
| `EXPIRED` | Not picked up within 10 minutes |

---

## Using the client directly

```ts
import { QCMonitorClient } from '@bagasfd09/qc-monitor-reporter';

const client = new QCMonitorClient({
  apiUrl: 'http://localhost:3001',
  apiKey: 'cld_abc123...',
  retries: 3,
});

const runId = await client.createRun();
if (runId) {
  const resultId = await client.reportResult({
    testRunId: runId,
    testCaseId: 'cm1tc001',
    status: 'PASSED',
    duration: 1342,
  });

  if (resultId) {
    await client.uploadArtifact(resultId, 'SCREENSHOT', './screenshot.png');
  }

  await client.finishRun(runId, {
    totalTests: 1, passed: 1, failed: 0, skipped: 0, duration: 1342,
  });
}
```

### Retry watcher programmatic API

```ts
import { QCMonitorClient, RetryWatcher } from '@bagasfd09/qc-monitor-reporter';

const client = new QCMonitorClient({ apiUrl: '...', apiKey: '...' });
const watcher = new RetryWatcher(client, 30_000); // poll every 30s

watcher.start();

// Stop on shutdown
process.on('SIGINT', () => { watcher.stop(); process.exit(0); });
```

---

## Real-time dashboard

Connect a WebSocket to stream live results as tests run:

```
ws://localhost:3001/ws?apiKey=cld_abc123...
```

Events: `connected`, `run:started`, `run:finished`, `result:new`, `result:failed`, `artifact:new`, `retry:requested`

Each event has the shape `{ event: string, data: object, timestamp: string }`.

---

## Publishing (maintainers only)

### Step 1 — Create a PAT with write access

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Click **Generate new token (classic)**
3. Tick **`write:packages`** (this also grants `read:packages`)
4. Copy the token

### Step 2 — Authenticate with the GitHub Packages registry

```bash
npm login --registry=https://npm.pkg.github.com --scope=@bagasfd09
# Username: your GitHub username
# Password: your PAT (ghp_...)
# Email: your GitHub email
```

Or set the token directly in `~/.npmrc`:

```
//npm.pkg.github.com/:_authToken=ghp_your_token_here
```

### Step 3 — Build and publish

From the monorepo root:

```bash
pnpm publish:reporter
```

This runs `pnpm --filter @bagasfd09/qc-monitor-reporter publish`, which triggers the `prepublishOnly` script (`pnpm build`) automatically before publishing.
