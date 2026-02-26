/**
 * Integration test setup script (standalone).
 *
 * Creates three showcase teams and writes the primary team's apiKey to
 * tests/integration/sample-tests/.env so Playwright picks it up automatically
 * (Playwright v1.44+ auto-loads .env).
 *
 * Run from the monorepo root:
 *   npx tsx tests/integration/setup.ts
 *
 * Then run Playwright separately:
 *   npx playwright test --config=tests/integration/sample-tests/playwright.config.ts
 */

import fs from 'fs/promises';
import path from 'path';

const API_URL = process.env['QC_MONITOR_API_URL'] ?? 'http://localhost:3001';
const SAMPLE_DIR = path.resolve(process.cwd(), 'tests/integration/sample-tests');

// ─── Types ────────────────────────────────────────────────────────────────────

interface Team {
  id: string;
  name: string;
  apiKey: string;
}

const TEAM_NAMES = ['QA Web Team', 'QA Mobile Team', 'QA API Team'] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createTeam(name: string): Promise<Team> {
  const res = await fetch(`${API_URL}/api/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    const text = await res.text();
    const isConflict = res.status === 409 || text.includes('Unique constraint');
    if (isConflict) {
      throw new Error(
        `Team "${name}" already exists.\n` +
          `    Reset the DB with: pnpm --filter @qc-monitor/db db:push --force-reset`,
      );
    }
    throw new Error(`Failed to create team "${name}": ${res.status} ${text}`);
  }

  return res.json() as Promise<Team>;
}

function printTable(teams: Team[]): void {
  const COL1 = 18;
  const COL2 = 29;
  const h = '─';
  const v = '│';
  const tl = '┌', tr = '┐', bl = '└', br = '┘', ml = '├', mr = '┤', mc = '┼';

  const row = (a: string, b: string) =>
    `${v} ${a.padEnd(COL1)} ${v} ${b.padEnd(COL2)} ${v}`;
  const divider = (l: string, m: string, r: string) =>
    `${l}${h.repeat(COL1 + 2)}${m}${h.repeat(COL2 + 2)}${r}`;

  console.log(`\n  ${divider(tl, '┬', tr)}`);
  console.log(`  ${row('Team Name', 'API Key')}`);
  console.log(`  ${divider(ml, mc, mr)}`);
  for (const t of teams) {
    const key = t.apiKey.length > COL2 ? t.apiKey.slice(0, COL2 - 3) + '...' : t.apiKey;
    console.log(`  ${row(t.name, key)}`);
  }
  console.log(`  ${divider(bl, '┴', br)}\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

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

  // ── 2. Create teams ──────────────────────────────────────────────────────────
  console.log(`    Creating teams...\n`);
  const teams: Team[] = [];

  for (const name of TEAM_NAMES) {
    try {
      const team = await createTeam(name);
      teams.push(team);
      console.log(`    ✓ Created "${team.name}"`);
    } catch (err) {
      console.error(`\n❌  ${(err as Error).message}`);
      process.exit(1);
    }
  }

  printTable(teams);

  // ── 3. Write primary team's apiKey to .env ───────────────────────────────────
  const primary = teams[0]!;
  const envPath = path.join(SAMPLE_DIR, '.env');
  await fs.writeFile(
    envPath,
    [`QC_MONITOR_API_URL=${API_URL}`, `QC_MONITOR_API_KEY=${primary.apiKey}`, ''].join('\n'),
    'utf8',
  );
  console.log(`  ✅  ${primary.name} apiKey saved to sample-tests/.env\n`);

  console.log(`    Run Playwright manually:`);
  console.log(
    `      npx playwright test --config=tests/integration/sample-tests/playwright.config.ts\n`,
  );
}

main().catch((err: unknown) => {
  console.error('\nSetup failed:', err);
  process.exit(1);
});
