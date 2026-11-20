// ponytail: プロセス内メモリのみ。複数インスタンス/サーバーレス構成にしたら Redis 等の共有ストアへ移す
const LOCK_MS = 15 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

/**
 * 直近 15 分以内の失敗回数の上限。
 * - account: メール+IP 単位。別 IP の攻撃者が本人をロックアウトできないようにする
 * - ip: IP 単位。1 つの IP から多数のアカウントを試すパスワードスプレーを止める
 * - email: メール単位の最後の砦。IP を偽装・分散されても 1 アカウントへの総当たりに上限をかける
 */
const LIMITS = { account: 5, ip: 20, email: 50 } as const;

const failures = new Map<string, { count: number; until: number }>();
let lastSweep = 0;

function keys(email: string, ip: string) {
  const e = email.toLowerCase();
  return { account: `account:${e}|${ip}`, ip: `ip:${ip}`, email: `email:${e}` };
}

/** 期限切れのエントリを捨てる（失敗が続くとエントリが溜まり続けるため） */
function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, f] of failures) {
    if (f.until <= now) failures.delete(key);
  }
}

function exceeded(key: string, limit: number, now: number): boolean {
  const f = failures.get(key);
  return !!f && f.until > now && f.count >= limit;
}

function increment(key: string, now: number): void {
  const f = failures.get(key);
  const count = f && f.until > now ? f.count + 1 : 1;
  failures.set(key, { count, until: now + LOCK_MS });
}

export function isLockedOut(email: string, ip: string, now = Date.now()): boolean {
  sweep(now);
  const k = keys(email, ip);
  return (
    exceeded(k.account, LIMITS.account, now) ||
    exceeded(k.ip, LIMITS.ip, now) ||
    exceeded(k.email, LIMITS.email, now)
  );
}

export function recordLoginFailure(email: string, ip: string, now = Date.now()): void {
  sweep(now);
  const k = keys(email, ip);
  increment(k.account, now);
  increment(k.ip, now);
  increment(k.email, now);
}

/**
 * ログイン成功時はそのアカウントのカウンタだけ消す。
 * IP カウンタまで消すと、手持ちの正規アカウントでログインするたびにスプレー対策がリセットされてしまう。
 */
export function clearLoginFailures(email: string, ip: string): void {
  const k = keys(email, ip);
  failures.delete(k.account);
  failures.delete(k.email);
}

/**
 * クライアント IP を取得する。X-Forwarded-For はクライアントが先頭に任意の値を書けるため、
 * 直前のプロキシが追記する末尾の値を使う。
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const last = forwarded?.split(",").map((s) => s.trim()).filter(Boolean).at(-1);
  return last || request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** テスト用 */
export function resetLoginThrottle(): void {
  failures.clear();
  lastSweep = 0;
}

/** テスト用 */
export function loginThrottleSize(): number {
  return failures.size;
}
