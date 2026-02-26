import { test, expect } from '@playwright/test';

test.describe('Products', () => {
  test.describe('Edit Product', () => {
    test('can edit product name', async ({ page }) => {
      await page.goto('https://demo.playwright.dev/todomvc/');
      await page.getByPlaceholder('What needs to be done?').fill('Old Name');
      await page.getByPlaceholder('What needs to be done?').press('Enter');
      await page.getByTestId('todo-title').first().dblclick();
      const editInput = page.getByTestId('todo-title').first().locator('..').locator('input');
      await editInput.fill('New Name');
      await editInput.press('Enter');
    });

    test('can cancel edit', async ({ page }) => {
      await page.goto('https://demo.playwright.dev/todomvc/');
      await page.getByPlaceholder('What needs to be done?').fill('Keep This');
      await page.getByPlaceholder('What needs to be done?').press('Enter');
      await page.getByTestId('todo-title').first().dblclick();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('todo-title').first()).toHaveText('Keep This');
    });
  });
});
