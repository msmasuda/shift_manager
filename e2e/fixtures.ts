import { request, type APIRequestContext } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const ADMIN_AUTH_FILE = 'e2e/.auth/admin.json';

export const MEMBER_EMAIL = 'sato@cafe.example.com';
export const MEMBER_NAME = '佐藤 花子';

/** 既存データと見分けるため、テスト用シフトには普段使わない時刻を使う */
export const FIXTURE_START = '07:11';
export const FIXTURE_END = '15:47';

function ym(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 管理画面のデフォルト表示月（翌月）。過去日扱いにならないのでテストデータの置き場所に使う */
export function nextMonth(): string {
  const d = new Date();
  return ym(new Date(d.getFullYear(), d.getMonth() + 1, 1));
}

export async function adminApi(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: BASE_URL, storageState: ADMIN_AUTH_FILE });
}

/**
 * 翌月のどこかにテスト用シフトを 1 件作り、その id を返す。
 * 既存シフト・休み・休日と重なる日（409）は避けて次の日を試すので、既存データは書き換えない。
 */
export async function createFixtureShift(
  api: APIRequestContext,
  email = MEMBER_EMAIL,
): Promise<string> {
  const usersRes = await api.get('/api/users');
  if (!usersRes.ok()) throw new Error(`GET /api/users failed: ${usersRes.status()}`);
  const users: { id: string; email: string }[] = await usersRes.json();
  const user = users.find((u) => u.email === email);
  if (!user) throw new Error(`user not found: ${email}`);

  const month = nextMonth();
  for (let day = 1; day <= 28; day++) {
    const res = await api.post('/api/shifts', {
      data: {
        date: `${month}-${String(day).padStart(2, '0')}`,
        userId: user.id,
        startTime: FIXTURE_START,
        endTime: FIXTURE_END,
      },
    });
    if (res.status() === 201) return (await res.json()).id;
    if (res.status() !== 409) throw new Error(`POST /api/shifts failed: ${res.status()} ${await res.text()}`);
  }
  throw new Error(`no free day for ${email} in ${month}`);
}

export async function deleteShift(api: APIRequestContext, id: string): Promise<void> {
  await api.delete(`/api/shifts/${id}`);
}
