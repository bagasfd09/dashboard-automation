import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test.describe('Invalid Login', () => {
    test('rejects empty input', async ({ page }) => {
      await page.goto('https://demo.playwright.dev/todomvc/');
      await page.getByPlaceholder('What needs to be done?').press('Enter');
      await expect(page.getByTestId('todo-title')).toHaveCount(0);
    });

    // ⚠️  This test INTENTIONALLY FAILS to showcase screenshot/video capture.
    // Do not "fix" this assertion.
    test('shows error for invalid page', async ({ page }) => {
      await page.goto('https://demo.playwright.dev/todomvc/');
      await expect(page.getByText('THIS DOES NOT EXIST')).toBeVisible({ timeout: 3000 });
    });
  });
});
