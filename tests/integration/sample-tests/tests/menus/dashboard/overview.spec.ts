import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.describe('Overview', () => {
    test('shows item count', async ({ page }) => {
      await page.goto('https://demo.playwright.dev/todomvc/');
      await page.getByPlaceholder('What needs to be done?').fill('Item 1');
      await page.getByPlaceholder('What needs to be done?').press('Enter');
      await expect(page.getByText('1 item left')).toBeVisible();
    });

    test('updates count when adding items', async ({ page }) => {
      await page.goto('https://demo.playwright.dev/todomvc/');
      for (let i = 1; i <= 3; i++) {
        await page.getByPlaceholder('What needs to be done?').fill(`Item ${i}`);
        await page.getByPlaceholder('What needs to be done?').press('Enter');
      }
      await expect(page.getByText('3 items left')).toBeVisible();
    });
  });
});
