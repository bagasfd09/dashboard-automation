import { defineConfig } from '@playwright/test';

/**
 * Playwright config for the QC Monitor integration test suite.
 *
 * QC_MONITOR_API_URL and QC_MONITOR_API_KEY are loaded automatically by
 * Playwright (v1.44+) from the .env file in this directory.
 * The .env file is written by tests/integration/setup.ts before this runs.
 */
export default defineConfig({
  testDir: './tests',

  // Allow one retry so flaky network tests don't fail the whole run
  retries: 1,

  // Run tests sequentially so the API isn't hammered in parallel
  workers: 1,

  // 30 s per test — example.com can be slow on some networks
  timeout: 30_000,

  use: {
    // Capture screenshot only when a test fails → uploaded as SCREENSHOT artifact
    screenshot: 'only-on-failure',
    // Keep video only for failed tests → uploaded as VIDEO artifact
    video: 'retain-on-failure',
  },

  reporter: [
    // Keep the standard list output in the terminal
    ['list'],
    // QC Monitor reporter — resolves relative to this config file
    [
      '../../../packages/reporter/dist/playwright',
      {
        apiUrl: process.env['QC_MONITOR_API_URL'] ?? 'http://localhost:3001',
        apiKey: process.env['QC_MONITOR_API_KEY'] ?? '',
        captureScreenshot: true,
        captureVideo: true,
        captureTrace: false, // traces add overhead; enable for deep debugging
      },
    ],
  ],
});
