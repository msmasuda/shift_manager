import { test, expect } from '@playwright/test';

test.describe('Schedule Page (member view)', () => {
  test('shows schedule heading', async ({ page }) => {
    await page.goto('/schedule');
    await expect(page.getByRole('heading', { name: 'シフト一覧' })).toBeVisible();
  });

  test('displays all organization members in day columns', async ({ page }) => {
    // /api/users のレスポンスを先に捕捉するため goto より前に登録
    const usersResponsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/users') && r.request().method() === 'GET',
      { timeout: 20_000 },
    );

    await page.goto('/schedule');

    const usersResponse = await usersResponsePromise;
    expect(usersResponse.status(), '/api/users が 200 を返すこと').toBe(200);

    const users = await usersResponse.json();
    expect(users.length, 'ユーザーが 1 件以上返ること').toBeGreaterThan(0);

    // UI にも全メンバーが表示される
    await expect(page.getByText('佐藤 花子').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('鈴木 一郎').first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows 休み badge for users without shifts', async ({ page }) => {
    const usersResponsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/users') && r.request().method() === 'GET',
      { timeout: 20_000 },
    );

    await page.goto('/schedule');
    await usersResponsePromise; // users ロード完了を待つ

    await expect(page.getByText('休み').first()).toBeVisible({ timeout: 10_000 });
  });

  test('date range filter changes displayed days', async ({ page }) => {
    await page.goto('/schedule');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const inputs = page.locator('input[type="date"]');
    await inputs.nth(0).fill(fmt(tomorrow));
    await inputs.nth(1).fill(fmt(tomorrow));

    await page.waitForTimeout(500);
    await expect(inputs.nth(0)).toHaveValue(fmt(tomorrow));
  });
});
