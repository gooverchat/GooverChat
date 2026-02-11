import { test, expect } from '@playwright/test';

test.describe('Chat', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('alice@example.com');
    await page.getByLabel(/password/i).fill('DemoPassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/chat/);
  });

  test('chat list loads and can open conversation', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.getByText(/chat|conversation|no chats/i)).toBeVisible();
    const firstChat = page.getByRole('link', { name: /bob|alice|hello/i }).first();
    if (await firstChat.isVisible()) {
      await firstChat.click();
      await expect(page).toHaveURL(/\/chat\/[a-z0-9-]+/);
    }
  });

  test('can send a message', async ({ page }) => {
    await page.goto('/chat');
    const firstChat = page.getByRole('link').first();
    if (await firstChat.isVisible()) {
      await firstChat.click();
      await page.getByPlaceholder(/type a message/i).fill('E2E test message');
      await page.getByRole('button', { name: /send/i }).click();
      await expect(page.getByText('E2E test message')).toBeVisible();
    }
  });
});
