import { test, expect } from '@playwright/test';

/**
 * This test always passes.
 * Verifies that QC Monitor records a PASSED result for a successful test.
 */
test('example.com has the correct title', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle('Example Domain');
});
