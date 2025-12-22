import { test, expect } from '@playwright/test';

test.describe('Authentication E2E Tests', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Socks Proxy Management/);
  });

  test('should show register link', async ({ page }) => {
    await page.goto('/login');
    const registerLink = page.getByText('还没有账号？立即注册');
    await expect(registerLink).toBeVisible();
  });
});







