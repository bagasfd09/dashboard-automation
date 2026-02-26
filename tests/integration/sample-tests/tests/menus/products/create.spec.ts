import { test, expect } from '@playwright/test';

test.describe('Products', () => {
  test.describe('Create Product', () => {
    test('can create with valid data', async ({ page }) => {
      await page.goto('https://demo.playwright.dev/todomvc/');
      await page.getByPlaceholder('What needs to be done?').fill('New Product');
      await page.getByPlaceholder('What needs to be done?').press('Enter');
      await expect(page.getByTestId('todo-title').first()).toHaveText('New Product');
    });

    test('shows error for empty name', async ({ page }) => {
      await page.goto('https://demo.playwright.dev/todomvc/');
      await page.getByPlaceholder('What needs to be done?').press('Enter');
      await expect(page.getByTestId('todo-title')).toHaveCount(0);
    });

    test('shows error for duplicate name', async ({ page }) => {
      await page.goto('https://demo.playwright.dev/todomvc/');
      await page.getByPlaceholder('What needs to be done?').fill('Duplicate');
      await page.getByPlaceholder('What needs to be done?').press('Enter');
      await page.getByPlaceholder('What needs to be done?').fill('Duplicate');
      await page.getByPlaceholder('What needs to be done?').press('Enter');
      await expect(page.getByTestId('todo-title')).toHaveCount(2);
    });

    test('can create with special characters', async ({ page }) => {
      await page.goto('https://demo.playwright.dev/todomvc/');
      await page.getByPlaceholder('What needs to be done?').fill('Product @#$% Special!');
      await page.getByPlaceholder('What needs to be done?').press('Enter');
      await expect(page.getByTestId('todo-title').first()).toHaveText('Product @#$% Special!');
    });

    test('can create multiple products', async ({ page }) => {
      await page.goto('https://demo.playwright.dev/todomvc/');
      for (let i = 1; i <= 3; i++) {
        await page.getByPlaceholder('What needs to be done?').fill(`Product ${i}`);
        await page.getByPlaceholder('What needs to be done?').press('Enter');
      }
      await expect(page.getByTestId('todo-title')).toHaveCount(3);
    });
  });
});
