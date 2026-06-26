import { test as setup } from '@playwright/test';
import fs from 'fs';

const adminAuthFile = 'e2e/.auth/admin.json';
const memberAuthFile = 'e2e/.auth/member.json';

setup.beforeAll(async () => {
  fs.mkdirSync('e2e/.auth', { recursive: true });
});

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');
  // dev credentials フォームが表示されるまで待機
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', 'yamada@cafe.example.com');
  await page.click('button[type="submit"]');
  // admin は / → /admin にリダイレクト
  await page.waitForURL('/admin', { timeout: 15_000 });
  await page.context().storageState({ path: adminAuthFile });
});

setup('authenticate as member', async ({ page }) => {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', 'sato@cafe.example.com');
  await page.click('button[type="submit"]');
  // member は / → /my-shifts にリダイレクト
  await page.waitForURL('/my-shifts', { timeout: 15_000 });
  await page.context().storageState({ path: memberAuthFile });
});
