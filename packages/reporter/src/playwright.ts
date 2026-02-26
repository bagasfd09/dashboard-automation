import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
} from '@playwright/test/reporter';
import path from 'path';
import { QCMonitorClient } from './core.js';
import type { ArtifactType, TestStatus } from './core.js';
import { loadConfig } from './config.js';
import type { QCMonitorConfig } from './config.js';

// ─── Status mapping ──────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, TestStatus> = {
  passed: 'PASSED',
  failed: 'FAILED',
  timedOut: 'FAILED',
  skipped: 'SKIPPED',
  interrupted: 'SKIPPED',
};

// ─── Attachment type mapping ─────────────────────────────────────────────────

const ATTACHMENT_TYPE_MAP: Record<string, ArtifactType> = {
  screenshot: 'SCREENSHOT',
  video: 'VIDEO',
  trace: 'TRACE',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Collect all TestCase leaves from a suite tree. */
function collectTests(suite: Suite): TestCase[] {
  const tests: TestCase[] = [...suite.tests];
  for (const child of suite.suites) {
    tests.push(...collectTests(child));
  }
  return tests;
}

/** Build a stable map key from a Playwright TestCase. */
function testKey(test: TestCase, cwd: string): string {
  const rel = path.relative(cwd, test.location.file).replace(/\\/g, '/');
  return `${rel}::${test.title}`;
}

/** Relative file path for syncing. */
function relativeFile(test: TestCase, cwd: string): string {
  return path.relative(cwd, test.location.file).replace(/\\/g, '/');
}

/**
 * Walk the test's parent chain and collect describe-level suite titles.
 * Returns them joined with " > " (e.g. "Auth > Login"), or undefined if no describes.
 */
export function getSuiteName(test: TestCase): string | undefined {
  const parts: string[] = [];
  let node: Suite | undefined = test.parent;
  while (node) {
    if (node.type === 'describe' && node.title) {
      parts.unshift(node.title);
    }
    node = node.parent;
  }
  return parts.length > 0 ? parts.join(' > ') : undefined;
}

// ─── Reporter ────────────────────────────────────────────────────────────────

/**
 * Playwright Reporter that syncs test cases and streams results to QC Monitor.
 *
 * Usage in playwright.config.ts:
 * ```ts
 * reporter: [
 *   ['@qc-monitor/reporter/playwright', { apiUrl: '...', apiKey: '...' }],
 * ]
 * ```
 */
export default class QCMonitorPlaywrightReporter implements Reporter {
  private readonly options: Partial<QCMonitorConfig>;
  private client!: QCMonitorClient;
  private config!: QCMonitorConfig;
  private cwd!: string;

  /** Resolved during onBegin; awaited in onTestEnd to serialise async init. */
  private beginPromise: Promise<void> = Promise.resolve();

  /** runId returned by POST /api/runs */
  private runId: string | null = null;

  /** Maps `${relativeFilePath}::${testTitle}` → testCaseId */
  private readonly testCaseIdMap = new Map<string, string>();

  // Final outcome per test key (updated on each attempt so retries overwrite)
  private readonly testOutcomes = new Map<string, TestStatus>();

  constructor(options: Partial<QCMonitorConfig> = {}) {
    this.options = options;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  onBegin(_config: FullConfig, suite: Suite): void {
    this.cwd = process.cwd();
    this.beginPromise = this.doBegin(suite);
  }

  private async doBegin(suite: Suite): Promise<void> {
    // Resolve final config: constructor options > env vars > config file > defaults
    this.config = await loadConfig(this.options);

    if (!this.config.apiUrl || !this.config.apiKey) {
      console.warn(
        '[QC Monitor] apiUrl and apiKey are required. ' +
          'Set QC_MONITOR_API_URL / QC_MONITOR_API_KEY or create qc-monitor.config.js.',
      );
      return;
    }

    this.client = new QCMonitorClient({
      apiUrl: this.config.apiUrl,
      apiKey: this.config.apiKey,
      retries: this.config.retries,
    });

    // Collect every test in the suite tree
    const tests = collectTests(suite);

    // Deduplicate by (filePath, title) — same test can appear in multiple projects
    const seen = new Set<string>();
    const toSync = tests
      .map((t) => ({
        title: t.title,
        filePath: relativeFile(t, this.cwd),
        tags: [] as string[],
        suiteName: getSuiteName(t),
      }))
      .filter(({ filePath, title }) => {
        const k = `${filePath}::${title}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

    // Sync + create run in parallel
    const [syncedCases, runId] = await Promise.all([
      this.client.syncTestCases(toSync),
      this.client.createRun(),
    ]);

    this.runId = runId;

    // Build lookup map
    for (const tc of syncedCases) {
      const k = `${tc.filePath}::${tc.title}`;
      this.testCaseIdMap.set(k, tc.id);
    }
  }

  async onTestEnd(test: TestCase, result: TestResult): Promise<void> {
    // Wait for onBegin async work to finish before processing any result
    await this.beginPromise;

    if (!this.runId) return; // begin failed — skip silently

    const k = testKey(test, this.cwd);
    const testCaseId = this.testCaseIdMap.get(k);
    if (!testCaseId) return; // not in the sync response — skip

    const status = STATUS_MAP[result.status] ?? 'SKIPPED';

    // Track the latest outcome per test case (retries overwrite the previous attempt)
    this.testOutcomes.set(k, status);

    // Error message: combine error + step-level messages
    const errorMsg =
      result.errors
        .map((e) => e.message ?? String(e))
        .filter(Boolean)
        .join('\n') || undefined;

    const resultId = await this.client.reportResult({
      testRunId: this.runId,
      testCaseId,
      status,
      duration: result.duration,
      error: errorMsg,
      retryCount: result.retry,
    });

    // Upload artifacts for failed / timed-out tests
    const isFailed = result.status === 'failed' || result.status === 'timedOut';
    if (!isFailed || !resultId) return;

    await this.uploadAttachments(resultId, result);
  }

  async onEnd(result: FullResult): Promise<void> {
    await this.beginPromise;

    if (!this.runId) {
      console.warn('[QC Monitor] Run was never started — no results reported.');
      return;
    }

    // Derive final per-test-case counts (retries don't inflate the numbers)
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    for (const s of this.testOutcomes.values()) {
      if (s === 'PASSED') passed++;
      else if (s === 'FAILED') failed++;
      else skipped++;
    }
    const totalTests = passed + failed + skipped;

    await this.client.finishRun(this.runId, {
      totalTests,
      passed,
      failed,
      skipped,
      duration: result.duration,
    });

    const icon = failed === 0 ? '✅' : '❌';
    console.log(
      `${icon} QC Monitor: Results reported. Run ID: ${this.runId} ` +
        `(${passed} passed, ${failed} failed, ${skipped} skipped)`,
    );
  }

  // ── Artifact upload ────────────────────────────────────────────────────────

  private async uploadAttachments(resultId: string, result: TestResult): Promise<void> {
    for (const attachment of result.attachments) {
      if (!attachment.path) continue; // body-only attachments are not supported

      const artifactType = ATTACHMENT_TYPE_MAP[attachment.name];
      if (!artifactType) continue; // unknown attachment name — skip

      // Respect config flags
      if (artifactType === 'SCREENSHOT' && !this.config.captureScreenshot) continue;
      if (artifactType === 'VIDEO' && !this.config.captureVideo) continue;
      if (artifactType === 'TRACE' && !this.config.captureTrace) continue;

      await this.client.uploadArtifact(resultId, artifactType, attachment.path);
    }
  }

  /** Let Playwright know this reporter writes to stdout. */
  printsToStdio(): boolean {
    return true;
  }
}
