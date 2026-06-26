import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
  });

  test('shows dashboard heading and add-shift form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    await expect(page.getByText('シフトの追加')).toBeVisible();
  });

  test('displays shift cards and 休み cards for all users', async ({ page }) => {
    // シフトありのカードと休みカードが両方存在する
    await expect(page.getByTestId('shift-card').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('holiday-card').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('休み').first()).toBeVisible();
  });

  test('pencil button opens inline edit form', async ({ page }) => {
    const card = page.getByTestId('shift-card').first();
    await expect(card).toBeVisible({ timeout: 10_000 });

    // ホバーで鉛筆ボタンが出現
    await card.hover();
    const editBtn = card.getByTestId('edit-shift-btn');
    await editBtn.click();

    // 編集フォームが開く
    await expect(page.getByText('開始')).toBeVisible();
    await expect(page.getByText('終了')).toBeVisible();
    await expect(page.getByRole('button', { name: '保存' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'キャンセル' })).toBeVisible();
  });

  test('cancel closes inline edit form without saving', async ({ page }) => {
    const card = page.getByTestId('shift-card').first();
    await expect(card).toBeVisible({ timeout: 10_000 });

    await card.hover();
    await card.getByTestId('edit-shift-btn').click();
    await page.getByRole('button', { name: 'キャンセル' }).click();

    // フォームが閉じ、通常表示に戻る
    await expect(page.getByText('開始')).not.toBeVisible();
    await expect(page.getByTestId('shift-card').first()).toBeVisible();
  });

  test('save updates shift time', async ({ page }) => {
    const card = page.getByTestId('shift-card').first();
    await expect(card).toBeVisible({ timeout: 10_000 });

    await card.hover();
    await card.getByTestId('edit-shift-btn').click();

    // 時刻を変更
    const timeInputs = page.locator('input[type="time"]');
    await timeInputs.nth(0).fill('10:00');
    await timeInputs.nth(1).fill('19:00');
    await page.getByRole('button', { name: '保存' }).click();

    // 保存後: フォームが閉じ、新しい時刻が表示される
    await expect(page.getByText('10:00 - 19:00')).toBeVisible({ timeout: 10_000 });
  });

  test('can add a new shift via the form', async ({ page }) => {
    // 日付・ユーザー・時刻を入力して追加
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);

    await page.fill('input[type="date"]', dateStr);
    await page.fill('input[type="time"]:nth-of-type(1)', '08:00');
    await page.fill('input[type="time"]:nth-of-type(2)', '17:00');
    await page.getByRole('button', { name: '追加する' }).click();

    // 追加後にシフトカードが（少なくとも1枚）表示されている
    await expect(page.getByTestId('shift-card').first()).toBeVisible({ timeout: 10_000 });
  });
});
