import { defineConfig } from '@playwright/test';

/**
 * Playwright config for the QC Monitor integration test suite.
 *
 * Three projects:
 *  - flows   → tests/flows/**   serial steps, video + trace on failure
 *  - menus   → tests/menus/**   fully parallel, screenshot on failure
 *  - smoke   → tests/smoke/**   fully parallel, no retries, lightweight
 *
 * QC_MONITOR_API_URL and QC_MONITOR_API_KEY are injected by run.ts via env vars
 * (or auto-loaded by Playwright v1.44+ from .env in this directory).
 */
export default defineConfig({
  testDir: './tests',

  // Global timeout per test
  timeout: 30_000,

  reporter: [
    ['list'],
    [
      '../../../packages/reporter/dist/playwright',
      {
        apiUrl: process.env['QC_MONITOR_API_URL'] ?? 'http://localhost:3001',
        apiKey: process.env['QC_MONITOR_API_KEY'] ?? '',
        captureScreenshot: true,
        captureVideo: true,
        captureTrace: true,
      },
    ],
  ],

  projects: [
    // ── Flows ──────────────────────────────────────────────────────────────────
    // Serial multi-step tests that share state across steps.
    // Video, trace and screenshot are retained on failure for debugging.
    {
      name: 'flows',
      testMatch: '**/flows/**/*.spec.ts',
      retries: 1,
      use: {
        baseURL: 'https://demo.playwright.dev/todomvc/',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        trace: 'retain-on-failure',
      },
    },

    // ── Menus ──────────────────────────────────────────────────────────────────
    // Independent UI feature tests — run in full parallel for speed.
    // Screenshot captured on failure; no video to keep artifacts lean.
    {
      name: 'menus',
      testMatch: '**/menus/**/*.spec.ts',
      retries: 1,
      fullyParallel: true,
      use: {
        baseURL: 'https://demo.playwright.dev/todomvc/',
        screenshot: 'only-on-failure',
        video: 'off',
        trace: 'off',
      },
    },

    // ── Smoke ──────────────────────────────────────────────────────────────────
    // Critical-path sanity checks — fastest possible, zero retries.
    {
      name: 'smoke',
      testMatch: '**/smoke/**/*.spec.ts',
      retries: 0,
      fullyParallel: true,
      use: {
        baseURL: 'https://demo.playwright.dev/todomvc/',
        screenshot: 'off',
        video: 'off',
        trace: 'off',
      },
    },
  ],
});
