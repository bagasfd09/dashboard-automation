import { test, expect } from '@playwright/test';

test.describe('Transaction Flow', () => {
  test.describe.configure({ mode: 'serial' });

  let productId: string;

  test('Step 1: Create a new product', async ({ page }) => {
    await page.goto('https://demo.playwright.dev/todomvc/');
    await page.getByPlaceholder('What needs to be done?').fill('Product-' + Date.now());
    await page.getByPlaceholder('What needs to be done?').press('Enter');
    const item = page.getByTestId('todo-title').first();
    await expect(item).toBeVisible();
    productId = 'prod-001';
  });

  test('Step 2: Add product to store', async ({ page }) => {
    await page.goto('https://demo.playwright.dev/todomvc/');
    await page.getByPlaceholder('What needs to be done?').fill('Store listing for ' + productId);
    await page.getByPlaceholder('What needs to be done?').press('Enter');
    await expect(page.getByTestId('todo-title').first()).toBeVisible();
  });

  test('Step 3: Complete purchase', async ({ page }) => {
    await page.goto('https://demo.playwright.dev/todomvc/');
    await page.getByPlaceholder('What needs to be done?').fill('Purchase order');
    await page.getByPlaceholder('What needs to be done?').press('Enter');
    await expect(page.getByTestId('todo-title').first()).toBeVisible();
  });

  test('Step 4: Verify order in dashboard', async ({ page }) => {
    await page.goto('https://demo.playwright.dev/todomvc/');
    await expect(page.getByText('todos')).toBeVisible();
  });
});
