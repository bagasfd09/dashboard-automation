import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('app loads', async ({ page }) => {
    await page.goto('https://demo.playwright.dev/todomvc/');
    await expect(page).toHaveTitle(/React • TodoMVC/);
  });

  test('can add and complete a task', async ({ page }) => {
    await page.goto('https://demo.playwright.dev/todomvc/');
    await page.getByPlaceholder('What needs to be done?').fill('Quick task');
    await page.getByPlaceholder('What needs to be done?').press('Enter');
    await page.locator('.toggle').first().check();
    await expect(page.locator('.completed')).toHaveCount(1);
  });

  test('can clear completed tasks', async ({ page }) => {
    await page.goto('https://demo.playwright.dev/todomvc/');
    await page.getByPlaceholder('What needs to be done?').fill('To clear');
    await page.getByPlaceholder('What needs to be done?').press('Enter');
    await page.locator('.toggle').first().check();
    await page.getByRole('button', { name: 'Clear completed' }).click();
    await expect(page.getByTestId('todo-title')).toHaveCount(0);
  });
});
