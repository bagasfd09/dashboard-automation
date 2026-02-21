/**
 * Integration test runner.
 *
 * Combines setup (team creation) and Playwright invocation in a single
 * process so env vars (QC_MONITOR_API_KEY) are passed directly to the
 * Playwright child process instead of relying on .env file discovery,
 * which depends on Playwright's rootDir matching the CWD.
 *
 * Usage (from monorepo root):
 *   pnpm test:integration
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const API_URL = process.env['QC_MONITOR_API_URL'] ?? 'http://localhost:3001';
const SAMPLE_DIR = path.resolve(process.cwd(), 'tests/integration/sample-tests');
const CONFIG_PATH = path.join(SAMPLE_DIR, 'playwright.config.ts');

interface Team {
  id: string;
  name: string;
  apiKey: string;
}

async function main() {
  console.log('\n🔧  QC Monitor — Integration Test Setup');
  console.log(`    API: ${API_URL}\n`);

  // ── 1. Health check ──────────────────────────────────────────────────────────
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

  // ── 2. Create a fresh team ───────────────────────────────────────────────────
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

  // ── 3. Write .env for manual re-runs / documentation ────────────────────────
  const envPath = path.join(SAMPLE_DIR, '.env');
  await fs.writeFile(
    envPath,
    [`QC_MONITOR_API_URL=${API_URL}`, `QC_MONITOR_API_KEY=${team.apiKey}`, ''].join('\n'),
    'utf8',
  );
  console.log(`    ✓ .env written → ${envPath}`);

  console.log(`\n    Verify results after the run:`);
  console.log(`      curl ${API_URL}/api/runs \\`);
  console.log(`           -H "x-api-key: ${team.apiKey}"\n`);

  // ── 4. Run Playwright with env vars injected directly ────────────────────────
  // On Windows, .cmd files require shell: true. Passing args as a string
  // (not an array) avoids the DEP0190 deprecation warning Node emits when
  // shell: true is combined with an args array.
  const configArg = `"${CONFIG_PATH.replace(/\\/g, '/')}"`;
  const child = spawn(`npx playwright test --config=${configArg}`, [], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      QC_MONITOR_API_URL: API_URL,
      QC_MONITOR_API_KEY: team.apiKey,
    },
  });

  child.on('close', (code) => {
    process.exit(code ?? 1);
  });
}

main().catch((err: unknown) => {
  console.error('\nSetup failed:', err);
  process.exit(1);
});
