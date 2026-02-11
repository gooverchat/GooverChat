import { test, expect } from '@playwright/test';

test.describe('Auth', () => {
  test('home page has sign in and sign up links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
  });

  test('login page submits and redirects when valid', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('alice@example.com');
    await page.getByLabel(/password/i).fill('DemoPassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/chat/);
  });

  test('login shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('nobody@example.com');
    await page.getByLabel(/password/i).fill('wrong');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid/i)).toBeVisible();
  });
});
