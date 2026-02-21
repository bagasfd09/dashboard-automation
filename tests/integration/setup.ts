/**
 * Integration test setup script.
 *
 * Run from the monorepo root via:  pnpm test:integration
 *
 * What this does:
 *  1. Health-checks the QC Monitor API
 *  2. Creates a fresh team (timestamped name to avoid conflicts)
 *  3. Writes QC_MONITOR_API_KEY to tests/integration/sample-tests/.env
 *     so Playwright picks it up automatically (Playwright v1.44+ auto-loads .env)
 */

import fs from 'fs/promises';
import path from 'path';

const API_URL = process.env['QC_MONITOR_API_URL'] ?? 'http://localhost:3001';
// Always write .env relative to the monorepo root (script is run from there)
const SAMPLE_DIR = path.resolve(process.cwd(), 'tests/integration/sample-tests');

interface Team {
  id: string;
  name: string;
  apiKey: string;
}

async function main() {
  console.log('\n🔧  QC Monitor — Integration Test Setup');
  console.log(`    API: ${API_URL}\n`);

  // ── 1. Health check ────────────────────────────────────────────────────────
  try {
    const res = await fetch(`${API_URL}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { status: string };
    console.log(`    ✓ API reachable (status: ${body.status})`);
  } catch {
    console.error(`\n❌  Cannot reach the API at ${API_URL}`);
    console.error(`    Make sure it is running:\n`);
    console.error(`      pnpm --filter @qc-monitor/api dev\n`);
    process.exit(1);
  }

  // ── 2. Create a fresh team ─────────────────────────────────────────────────
  // Use a timestamp so re-running never hits the 409 name-conflict error.
  const teamName = `integration-${Date.now()}`;

  const res = await fetch(`${API_URL}/api/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: teamName }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`\n❌  Failed to create team: ${res.status} ${text}`);
    process.exit(1);
  }

  const team = (await res.json()) as Team;
  console.log(`    ✓ Team created: "${team.name}"`);
  console.log(`    ✓ apiKey: ${team.apiKey}`);

  // ── 3. Write .env ─────────────────────────────────────────────────────────
  const envPath = path.join(SAMPLE_DIR, '.env');
  await fs.writeFile(
    envPath,
    [`QC_MONITOR_API_URL=${API_URL}`, `QC_MONITOR_API_KEY=${team.apiKey}`, ''].join('\n'),
    'utf8',
  );
  console.log(`    ✓ .env written → ${envPath}`);

  console.log(`\n    Verify results after the run:`);
  console.log(`      curl http://localhost:3001/api/runs \\`);
  console.log(`           -H "x-api-key: ${team.apiKey}"\n`);
}

main().catch((err: unknown) => {
  console.error('\nSetup failed:', err);
  process.exit(1);
});
