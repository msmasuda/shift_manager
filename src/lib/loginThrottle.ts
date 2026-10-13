// ponytail: プロセス内メモリのみ。複数インスタンス/サーバーレス構成にしたら Redis 等の共有ストアへ移す
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

const failures = new Map<string, { count: number; until: number }>();

/** 直近 15 分以内に 5 回以上失敗したメールアドレスはロックする */
export function isLockedOut(email: string, now = Date.now()): boolean {
  const f = failures.get(email.toLowerCase());
  return !!f && f.until > now && f.count >= MAX_FAILURES;
}

export function recordLoginFailure(email: string, now = Date.now()): void {
  const key = email.toLowerCase();
  const f = failures.get(key);
  const count = f && f.until > now ? f.count + 1 : 1;
  failures.set(key, { count, until: now + LOCK_MS });
}

export function clearLoginFailures(email: string): void {
  failures.delete(email.toLowerCase());
}
