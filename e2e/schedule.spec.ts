import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  adminApi,
  createFixtureShift,
  deleteShift,
  nextMonth,
  MEMBER_NAME,
  FIXTURE_START,
  FIXTURE_END,
} from './fixtures';

test.describe('Schedule Page (member view)', () => {
  let api: APIRequestContext;
  let shiftId: string;

  test.beforeAll(async () => {
    // メンバーにはシフト作成権限がないので、テストデータは管理者の API で用意する
    api = await adminApi();
    shiftId = await createFixtureShift(api);
  });

  test.afterAll(async () => {
    await deleteShift(api, shiftId);
    await api.dispose();
  });

  test('shows schedule heading and current month', async ({ page }) => {
    await page.goto('/schedule');
    await expect(page.getByRole('heading', { name: 'シフトカレンダー' })).toBeVisible();

    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    await expect(page.locator('input[type="month"]')).toHaveValue(thisMonth);
  });

  test('month navigation switches to next month', async ({ page }) => {
    await page.goto('/schedule');
    await page.getByRole('button', { name: '次の月' }).click();
    await expect(page.locator('input[type="month"]')).toHaveValue(nextMonth());
  });

  test('highlights own shift in the calendar', async ({ page }) => {
    await page.goto('/schedule');
    await page.getByRole('button', { name: '次の月' }).click();

    // ログイン中のメンバー自身のシフトは「（自分）」付きで表示される
    await expect(page.getByText(`${MEMBER_NAME}（自分）`).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(`${FIXTURE_START}–${FIXTURE_END}`)).toBeVisible();
  });

  test('member cannot open the admin dashboard', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/my-shifts$/);
  });
});
