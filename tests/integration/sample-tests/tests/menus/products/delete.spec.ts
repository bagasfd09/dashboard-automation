import { test, expect } from '@playwright/test';

test.describe('Products', () => {
  test.describe('Delete Product', () => {
    test('can delete a product', async ({ page }) => {
      await page.goto('https://demo.playwright.dev/todomvc/');
      await page.getByPlaceholder('What needs to be done?').fill('Delete Me');
      await page.getByPlaceholder('What needs to be done?').press('Enter');
      await page.getByTestId('todo-title').first().hover();
      await page.locator('.destroy').first().click();
      await expect(page.getByTestId('todo-title')).toHaveCount(0);
    });

    test('can delete from multiple products', async ({ page }) => {
      await page.goto('https://demo.playwright.dev/todomvc/');
      await page.getByPlaceholder('What needs to be done?').fill('Keep');
      await page.getByPlaceholder('What needs to be done?').press('Enter');
      await page.getByPlaceholder('What needs to be done?').fill('Delete');
      await page.getByPlaceholder('What needs to be done?').press('Enter');
      await page.getByText('Delete').hover();
      await page.locator('.destroy').last().click();
      await expect(page.getByTestId('todo-title')).toHaveCount(1);
    });
  });
});
