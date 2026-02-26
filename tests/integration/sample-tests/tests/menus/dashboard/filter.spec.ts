import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.describe('Filters', () => {
    test('can filter active items', async ({ page }) => {
      await page.goto('https://demo.playwright.dev/todomvc/');
      await page.getByPlaceholder('What needs to be done?').fill('Active Task');
      await page.getByPlaceholder('What needs to be done?').press('Enter');
      await page.getByPlaceholder('What needs to be done?').fill('Completed Task');
      await page.getByPlaceholder('What needs to be done?').press('Enter');
      await page.locator('.toggle').last().check();
      await page.getByRole('link', { name: 'Active' }).click();
      await expect(page.getByTestId('todo-title')).toHaveCount(1);
    });

    test('can filter completed items', async ({ page }) => {
      await page.goto('https://demo.playwright.dev/todomvc/');
      await page.getByPlaceholder('What needs to be done?').fill('Task 1');
      await page.getByPlaceholder('What needs to be done?').press('Enter');
      await page.getByPlaceholder('What needs to be done?').fill('Task 2');
      await page.getByPlaceholder('What needs to be done?').press('Enter');
      await page.locator('.toggle').first().check();
      await page.getByRole('link', { name: 'Completed' }).click();
      await expect(page.getByTestId('todo-title')).toHaveCount(1);
    });

    test('can show all items', async ({ page }) => {
      await page.goto('https://demo.playwright.dev/todomvc/');
      await page.getByPlaceholder('What needs to be done?').fill('Item A');
      await page.getByPlaceholder('What needs to be done?').press('Enter');
      await page.getByPlaceholder('What needs to be done?').fill('Item B');
      await page.getByPlaceholder('What needs to be done?').press('Enter');
      await page.locator('.toggle').first().check();
      await page.getByRole('link', { name: 'All' }).click();
      await expect(page.getByTestId('todo-title')).toHaveCount(2);
    });
  });
});
