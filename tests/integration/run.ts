/**
 * Integration test runner.
 *
 * Creates three showcase teams, writes the primary team's apiKey to .env,
 * then spawns Playwright with optional --project filtering.
 *
 * Usage (from monorepo root):
 *   pnpm test:integration                    — run all projects
 *   pnpm test:integration:flows              — run only flows project
 *   pnpm test:integration:menus              — run only menus project
 *   pnpm test:integration:smoke              — run only smoke project
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const API_URL = process.env['QC_MONITOR_API_URL'] ?? 'http://localhost:3001';
const SAMPLE_DIR = path.resolve(process.cwd(), 'tests/integration/sample-tests');
const CONFIG_PATH = path.join(SAMPLE_DIR, 'playwright.config.ts');

// Optional --project=<name> forwarded from the npm script
const projectArg = process.argv.find((a) => a.startsWith('--project=')) ?? '';

// ─── Team definitions ─────────────────────────────────────────────────────────

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

  console.log(`    Verify results after the run:`);
  console.log(`      curl ${API_URL}/api/runs \\`);
  console.log(`           -H "x-api-key: ${primary.apiKey}"\n`);

  // ── 4. Run Playwright ────────────────────────────────────────────────────────
  const configArg = `"${CONFIG_PATH.replace(/\\/g, '/')}"`;
  const cmd = [
    `npx playwright test`,
    `--config=${configArg}`,
    projectArg,
  ]
    .filter(Boolean)
    .join(' ');

  const child = spawn(cmd, [], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      QC_MONITOR_API_URL: API_URL,
      QC_MONITOR_API_KEY: primary.apiKey,
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
