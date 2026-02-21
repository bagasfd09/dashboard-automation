import fs from 'fs/promises';
import path from 'path';

// ─── Types ──────────────────────────────────────────────────────────────────

export type TestStatus = 'PASSED' | 'FAILED' | 'SKIPPED' | 'RETRIED';
export type ArtifactType = 'SCREENSHOT' | 'VIDEO' | 'TRACE' | 'LOG';
export type RunStatus = 'RUNNING' | 'PASSED' | 'FAILED' | 'CANCELLED';

export interface SyncTestCase {
  title: string;
  filePath: string;
  tags?: string[];
}

export interface SyncedTestCase {
  id: string;
  title: string;
  filePath: string;
  tags: string[];
  teamId: string;
}

export interface ReportResultData {
  testRunId: string;
  testCaseId: string;
  status: TestStatus;
  duration?: number;
  error?: string;
  retryCount?: number;
}

export interface RunStats {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  /** Total suite duration in milliseconds */
  duration: number;
}

export interface QCMonitorClientOptions {
  apiUrl: string;
  apiKey: string;
  /** Number of retries on network/server failure (default: 2) */
  retries?: number;
}

// ─── MIME helpers ────────────────────────────────────────────────────────────

const MIME: Record<ArtifactType, string> = {
  SCREENSHOT: 'image/png',
  VIDEO: 'video/webm',
  TRACE: 'application/zip',
  LOG: 'text/plain',
};

// ─── Client ──────────────────────────────────────────────────────────────────

export class QCMonitorClient {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly retries: number;

  constructor(options: QCMonitorClientOptions) {
    this.apiUrl = options.apiUrl.replace(/\/$/, ''); // strip trailing slash
    this.apiKey = options.apiKey;
    this.retries = options.retries ?? 2;
  }

  // ── Retry wrapper ──────────────────────────────────────────────────────────

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt < this.retries) {
          // Exponential backoff: 1s, 2s, 4s, …
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }
    throw lastError;
  }

  // ── Request helper ─────────────────────────────────────────────────────────

  private async request<T = unknown>(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<T> {
    return this.withRetry(async () => {
      const isFormData = body instanceof FormData;

      const response = await fetch(`${this.apiUrl}${endpoint}`, {
        method,
        headers: {
          'x-api-key': this.apiKey,
          ...(body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body
          ? isFormData
            ? body
            : JSON.stringify(body)
          : undefined,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        throw new Error(`QC Monitor API ${response.status}: ${text}`);
      }

      // 204 No Content → return undefined cast to T
      if (response.status === 204) return undefined as T;
      return response.json() as Promise<T>;
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Upsert test cases by (filePath + title). Safe to call on every CI run.
   * Returns the synced items so callers can build a title→id map.
   */
  async syncTestCases(testCases: SyncTestCase[]): Promise<SyncedTestCase[]> {
    try {
      const res = await this.request<{ synced: number; items: SyncedTestCase[] }>(
        'POST',
        '/api/test-cases/sync',
        { testCases },
      );
      return res.items;
    } catch (err) {
      console.warn('[QC Monitor] Failed to sync test cases:', err);
      return [];
    }
  }

  /**
   * Start a new test run. Returns the run ID, or null if the call failed.
   */
  async createRun(): Promise<string | null> {
    try {
      const res = await this.request<{ id: string }>('POST', '/api/runs');
      return res.id;
    } catch (err) {
      console.warn('[QC Monitor] Failed to create run:', err);
      return null;
    }
  }

  /**
   * Mark the run as finished. Status is derived from stats.failed > 0.
   */
  async finishRun(runId: string, stats: RunStats): Promise<void> {
    try {
      const status: RunStatus = stats.failed > 0 ? 'FAILED' : 'PASSED';
      await this.request('PATCH', `/api/runs/${runId}`, {
        status,
        duration: Math.round(stats.duration),
      });
    } catch (err) {
      console.warn('[QC Monitor] Failed to finish run:', err);
    }
  }

  /**
   * Report an individual test result. Returns the result ID, or null on failure.
   */
  async reportResult(data: ReportResultData): Promise<string | null> {
    try {
      const res = await this.request<{ id: string }>('POST', '/api/results', {
        ...data,
        duration: data.duration !== undefined ? Math.round(data.duration) : undefined,
      });
      return res.id;
    } catch (err) {
      console.warn('[QC Monitor] Failed to report result:', err);
      return null;
    }
  }

  /**
   * Upload an artifact file for a test result.
   * Reads the file from disk and POSTs as multipart/form-data.
   */
  async uploadArtifact(
    testResultId: string,
    type: ArtifactType,
    filePath: string,
  ): Promise<void> {
    try {
      const buffer = await fs.readFile(filePath);
      const filename = path.basename(filePath);
      const mimeType = MIME[type] ?? 'application/octet-stream';

      const form = new FormData();
      form.append('testResultId', testResultId);
      form.append('type', type);
      // Let fetch set the multipart boundary — do NOT set Content-Type manually
      form.append('file', new Blob([buffer], { type: mimeType }), filename);

      await this.request('POST', '/api/artifacts/upload', form);
    } catch (err) {
      console.warn(`[QC Monitor] Failed to upload ${type} artifact (${filePath}):`, err);
    }
  }
}
