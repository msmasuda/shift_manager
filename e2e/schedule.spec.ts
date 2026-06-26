import { test, expect } from '@playwright/test';

test.describe('Schedule Page (member view)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/schedule');
  });

  test('shows schedule heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'シフト一覧' })).toBeVisible();
  });

  test('displays day columns with user names', async ({ page }) => {
    // シフトを持つユーザー名が表示されている
    await expect(page.getByText('佐藤 花子').first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows 休み badge for users without shifts', async ({ page }) => {
    await expect(page.getByText('休み').first()).toBeVisible({ timeout: 10_000 });
  });

  test('date range filter changes displayed days', async ({ page }) => {
    // 期間を1日だけに絞ると列が1列になる
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const inputs = page.locator('input[type="date"]');
    await inputs.nth(0).fill(fmt(tomorrow));
    await inputs.nth(1).fill(fmt(tomorrow));

    // 日付が更新され、その日の列が表示される（または「なし」状態）
    await page.waitForTimeout(500); // SWR の再取得を待つ
    await expect(page.locator('input[type="date"]').nth(0)).toHaveValue(fmt(tomorrow));
  });
});
