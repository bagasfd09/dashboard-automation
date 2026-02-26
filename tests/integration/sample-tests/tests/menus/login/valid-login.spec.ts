import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test.describe('Valid Login', () => {
    test('page loads correctly', async ({ page }) => {
      await page.goto('https://demo.playwright.dev/todomvc/');
      await expect(page).toHaveTitle(/React • TodoMVC/);
    });

    test('has input field visible', async ({ page }) => {
      await page.goto('https://demo.playwright.dev/todomvc/');
      await expect(page.getByPlaceholder('What needs to be done?')).toBeVisible();
    });
  });
});
