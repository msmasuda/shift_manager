import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  adminApi,
  createFixtureShift,
  deleteShift,
  nextMonth,
  FIXTURE_START,
  FIXTURE_END,
} from './fixtures';

test.describe('Admin Dashboard', () => {
  let api: APIRequestContext;
  let shiftId: string;

  test.beforeAll(async () => {
    api = await adminApi();
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test.beforeEach(async ({ page }) => {
    shiftId = await createFixtureShift(api);
    await page.goto('/admin');
  });

  test.afterEach(async () => {
    await deleteShift(api, shiftId);
  });

  const fixtureCard = (page: import('@playwright/test').Page) =>
    page.getByTestId('shift-card').filter({ hasText: `${FIXTURE_START} - ${FIXTURE_END}` });

  test('shows dashboard heading and next month by default', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    await expect(page.locator('input[type="month"]')).toHaveValue(nextMonth());
    await expect(page.getByRole('button', { name: '一括入力' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Excel出力' })).toBeVisible();
  });

  test('displays shift cards and 休み cards for all users', async ({ page }) => {
    // シフトありのカードと休みカードが両方存在する
    await expect(fixtureCard(page)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('holiday-card').first()).toBeAttached({ timeout: 10_000 });
    await expect(page.getByTestId('holiday-card').first()).toContainText('休み');
  });

  test('pencil button opens inline edit form', async ({ page }) => {
    const card = fixtureCard(page);
    await expect(card).toBeVisible({ timeout: 10_000 });

    // ホバーで鉛筆ボタンが出現
    await card.hover();
    await card.getByTestId('edit-shift-btn').click();

    // 編集フォームが開く
    const editingCard = page.getByTestId('shift-card').filter({ has: page.locator('input[type="time"]') });
    await expect(editingCard.getByText('開始')).toBeVisible();
    await expect(editingCard.getByText('終了')).toBeVisible();
    await expect(editingCard.locator('input[type="time"]').nth(0)).toHaveValue(FIXTURE_START);
    await expect(editingCard.getByRole('button', { name: '保存' })).toBeVisible();
    await expect(editingCard.getByRole('button', { name: 'キャンセル' })).toBeVisible();
  });

  test('cancel closes inline edit form without saving', async ({ page }) => {
    const card = fixtureCard(page);
    await expect(card).toBeVisible({ timeout: 10_000 });

    await card.hover();
    await card.getByTestId('edit-shift-btn').click();
    const editingCard = page.getByTestId('shift-card').filter({ has: page.locator('input[type="time"]') });
    await editingCard.locator('input[type="time"]').nth(0).fill('08:00');
    await editingCard.getByRole('button', { name: 'キャンセル' }).click();

    // フォームが閉じ、元の時刻のまま表示に戻る
    await expect(page.locator('[data-testid="shift-card"] input[type="time"]')).toHaveCount(0);
    await expect(fixtureCard(page)).toBeVisible();
  });

  test('save updates shift time', async ({ page }) => {
    const card = fixtureCard(page);
    await expect(card).toBeVisible({ timeout: 10_000 });

    await card.hover();
    await card.getByTestId('edit-shift-btn').click();

    // 編集中のカード内の time input だけに絞る
    const editingCard = page.getByTestId('shift-card').filter({ has: page.locator('input[type="time"]') });
    const timeInputs = editingCard.locator('input[type="time"]');
    await timeInputs.nth(0).fill('07:22');
    await timeInputs.nth(1).fill('15:58');
    await editingCard.getByRole('button', { name: '保存' }).click();

    // 保存後: フォームが閉じ、新しい時刻が表示される
    await expect(page.getByTestId('shift-card').filter({ hasText: '07:22 - 15:58' })).toBeVisible({ timeout: 10_000 });
    await expect(fixtureCard(page)).toHaveCount(0);
  });
});
