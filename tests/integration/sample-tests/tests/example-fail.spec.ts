import { test, expect } from '@playwright/test';

/**
 * This test intentionally fails.
 * Verifies that QC Monitor records a FAILED result and uploads the
 * screenshot (and video if captured) as artifacts.
 *
 * The wrong expected title is deliberate — do not "fix" it.
 */
test('intentional failure — wrong title assertion', async ({ page }) => {
  await page.goto('https://example.com');

  // ⚠️  This assertion is deliberately wrong to trigger a failure.
  // example.com's real title is "Example Domain".
  await expect(page).toHaveTitle('This Title Does Not Exist');
});
