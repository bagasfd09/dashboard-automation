import { spawn } from 'child_process';
import type { QCMonitorClient } from './core.js';

/** Escape a string for use in a Playwright `--grep` regex. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Polls `/api/retry/pending` on a fixed interval and triggers Playwright
 * for each PENDING retry request.
 */
export class RetryWatcher {
  private readonly client: QCMonitorClient;
  private readonly interval: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private polling = false;

  constructor(client: QCMonitorClient, interval = 30_000) {
    this.client = client;
    this.interval = interval;
  }

  start(): void {
    if (this.timer !== null) return;
    console.log(`[QC Monitor Watcher] Starting — polling every ${this.interval / 1000}s`);
    // Poll immediately, then on the interval
    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.interval);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[QC Monitor Watcher] Stopped');
  }

  private async poll(): Promise<void> {
    if (this.polling) return; // skip if previous poll hasn't finished
    this.polling = true;
    try {
      const retries = await this.client.getPendingRetries();
      for (const retry of retries) {
        const title = retry.testCase.title;
        console.log(`[QC Monitor Watcher] Running retry for: "${title}"`);
        await this.client.updateRetryStatus(retry.id, { status: 'RUNNING' });
        try {
          await this.runTest(title);
          await this.client.updateRetryStatus(retry.id, { status: 'COMPLETED' });
        } catch (err) {
          console.warn(`[QC Monitor Watcher] Test run failed for "${title}":`, err);
          // Mark as COMPLETED even on failure so the watcher doesn't re-attempt indefinitely.
          // The actual test result will reflect the failure.
          await this.client.updateRetryStatus(retry.id, { status: 'COMPLETED' });
        }
      }
    } catch (err) {
      console.warn('[QC Monitor Watcher] Poll error:', err);
    } finally {
      this.polling = false;
    }
  }

  private runTest(title: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        'npx',
        ['playwright', 'test', '--grep', escapeRegex(title), '--retries', '0'],
        {
          cwd: process.cwd(),
          stdio: 'inherit',
          shell: true,
          env: {
            ...process.env,
            QC_MONITOR_SOURCE: 'manual',
          },
        },
      );

      child.on('close', (code) => {
        if (code === 0 || code === 1) {
          // 0 = all passed, 1 = some failed — both are "completed" from the watcher's perspective
          resolve();
        } else {
          reject(new Error(`Playwright exited with code ${code}`));
        }
      });

      child.on('error', reject);
    });
  }
}
