# Integration Tests

End-to-end smoke test that runs a real Playwright suite against a live QC Monitor API and verifies the full pipeline: team creation → test sync (with suiteName) → run tracking → result reporting → artifact upload.

## What the test suite does

| File | Purpose |
|------|---------|
| `setup.ts` | Creates a fresh team via the API, writes the `apiKey` to `sample-tests/.env` |
| `sample-tests/tests/example-pass.spec.ts` | Navigates to example.com inside `test.describe('Navigation')` — **always passes** → recorded as `PASSED`, suiteName: `"Navigation"` |
| `sample-tests/tests/example-fail.spec.ts` | Asserts a wrong title inside `test.describe('Navigation')` — **always fails** → recorded as `FAILED`, screenshot uploaded, suiteName: `"Navigation"` |
| `sample-tests/tests/suite-names.spec.ts` | Nested `test.describe('Content > example.com')` — **always passes** → verifies suiteName propagation end-to-end |

## Prerequisites

All services must be running before you start.

### 1. Start Docker services (Postgres + MinIO + Redis)

```bash
docker-compose up -d
```

### 2. Push the database schema

```bash
pnpm --filter @qc-monitor/db db:push
```

### 3. Build the reporter (required — playwright.config.ts references the dist)

```bash
pnpm --filter @bagasfd09/qc-monitor-reporter build
```

### 4. Start the API

In a separate terminal:

```bash
pnpm --filter @qc-monitor/api dev
# API is ready when you see: "Server listening at http://0.0.0.0:3001"
```

### 5. Install Playwright browsers (first time only)

```bash
npx playwright install chromium
```

---

## Run the integration test

```bash
pnpm test:integration
```

This single command:
1. Runs `tests/integration/setup.ts` — creates a team and writes `.env`
2. Runs Playwright against `tests/integration/sample-tests/playwright.config.ts`
3. Streams results to the API in real time via `@qc-monitor/reporter`

Expected terminal output:

```
🔧  QC Monitor — Integration Test Setup
    API: http://localhost:3001

    ✓ API reachable (status: ok)
    ✓ Team created: "integration-1708512000000"
    ✓ apiKey: cld_abc123...
    ✓ .env written → .../sample-tests/.env

    Verify results after the run:
      curl http://localhost:3001/api/runs \
           -H "x-api-key: cld_abc123..."

Running 4 tests using 1 worker

  ✓  example-pass.spec.ts › Navigation › example.com has the correct title
  ✗  example-fail.spec.ts › Navigation › intentional failure — wrong title assertion
  ✓  suite-names.spec.ts › Content › example.com › page has a visible heading
  ✓  suite-names.spec.ts › Content › example.com › page contains a link

  3 passed, 1 failed

❌ QC Monitor: Results reported. Run ID: cm1run001 (3 passed, 1 failed, 0 skipped)
```

---

## Verify the data was recorded

Replace `<apiKey>` with the key printed during setup.

### List runs
```bash
curl http://localhost:3001/api/runs \
  -H "x-api-key: <apiKey>"
```

### Get a specific run (with nested results + artifacts)
```bash
curl http://localhost:3001/api/runs/<runId> \
  -H "x-api-key: <apiKey>"
```

### List test cases — verify suiteName is populated
```bash
curl http://localhost:3001/api/test-cases \
  -H "x-api-key: <apiKey>"
```

Expected `suiteName` values per test case:

| Test title | suiteName |
|---|---|
| `example.com has the correct title` | `"Navigation"` |
| `intentional failure — wrong title assertion` | `"Navigation"` |
| `page has a visible heading` | `"Content > example.com"` |
| `page contains a link` | `"Content > example.com"` |

### Download a screenshot artifact
```bash
curl -L http://localhost:3001/api/artifacts/<artifactId>/download \
  -H "x-api-key: <apiKey>" \
  -o screenshot.png
```

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Cannot reach the API at http://localhost:3001` | Run `pnpm --filter @qc-monitor/api dev` |
| `Failed to create team: 500` | Run `pnpm --filter @qc-monitor/db db:push` to apply the schema |
| `Browser not found` | Run `npx playwright install chromium` |
| `apiKey is empty` | `setup.ts` didn't run — check the test:integration script |
| MinIO upload fails | Run `docker-compose up -d` and verify MinIO is healthy |
| `.env` not picked up | Playwright v1.44+ required — check `npx playwright --version` |
| `Cannot find module '../../../packages/reporter/dist/playwright'` | Run `pnpm --filter @bagasfd09/qc-monitor-reporter build` first |
