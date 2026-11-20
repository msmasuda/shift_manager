import { describe, it, expect, beforeEach } from "vitest";
import {
  isLockedOut,
  recordLoginFailure,
  clearLoginFailures,
  getClientIp,
  resetLoginThrottle,
  loginThrottleSize,
} from "@/lib/loginThrottle";

const LOCK_MS = 15 * 60 * 1000;

describe("loginThrottle", () => {
  beforeEach(() => resetLoginThrottle());

  it("locks after 5 failures, unlocks after 15 minutes or on success", () => {
    const t = 1_000_000;
    for (let i = 0; i < 4; i++) recordLoginFailure("A@example.com", "1.1.1.1", t);
    expect(isLockedOut("a@example.com", "1.1.1.1", t)).toBe(false);
    recordLoginFailure("a@example.com", "1.1.1.1", t);
    expect(isLockedOut("a@example.com", "1.1.1.1", t)).toBe(true);
    expect(isLockedOut("a@example.com", "1.1.1.1", t + LOCK_MS + 1)).toBe(false);

    for (let i = 0; i < 5; i++) recordLoginFailure("b@example.com", "1.1.1.1", t);
    clearLoginFailures("b@example.com", "1.1.1.1");
    expect(isLockedOut("b@example.com", "1.1.1.1", t)).toBe(false);
  });

  it("does not lock out the account owner from a different IP", () => {
    const t = 1_000_000;
    for (let i = 0; i < 5; i++) recordLoginFailure("victim@example.com", "6.6.6.6", t);
    expect(isLockedOut("victim@example.com", "6.6.6.6", t)).toBe(true);
    expect(isLockedOut("victim@example.com", "2.2.2.2", t)).toBe(false);
  });

  it("locks an IP after 20 failures across different accounts", () => {
    const t = 1_000_000;
    for (let i = 0; i < 19; i++) recordLoginFailure(`user${i}@example.com`, "6.6.6.6", t);
    expect(isLockedOut("other@example.com", "6.6.6.6", t)).toBe(false);
    recordLoginFailure("user19@example.com", "6.6.6.6", t);
    expect(isLockedOut("other@example.com", "6.6.6.6", t)).toBe(true);
    expect(isLockedOut("other@example.com", "2.2.2.2", t)).toBe(false);
  });

  it("does not reset the IP counter on a successful login", () => {
    const t = 1_000_000;
    for (let i = 0; i < 20; i++) recordLoginFailure(`user${i}@example.com`, "6.6.6.6", t);
    clearLoginFailures("attacker@example.com", "6.6.6.6");
    expect(isLockedOut("next@example.com", "6.6.6.6", t)).toBe(true);
  });

  it("caps failures per email across many IPs", () => {
    const t = 1_000_000;
    for (let i = 0; i < 49; i++) recordLoginFailure("victim@example.com", `10.0.0.${i}`, t);
    expect(isLockedOut("victim@example.com", "2.2.2.2", t)).toBe(false);
    recordLoginFailure("victim@example.com", "10.0.1.0", t);
    expect(isLockedOut("victim@example.com", "2.2.2.2", t)).toBe(true);
  });

  it("sweeps expired entries", () => {
    const t = 1_000_000;
    for (let i = 0; i < 10; i++) recordLoginFailure(`user${i}@example.com`, `10.0.0.${i}`, t);
    expect(loginThrottleSize()).toBe(30);
    isLockedOut("x@example.com", "1.1.1.1", t + LOCK_MS + 1);
    expect(loginThrottleSize()).toBe(0);
  });
});

describe("getClientIp", () => {
  const req = (headers: Record<string, string>) =>
    new Request("http://localhost/api/auth/callback/credentials", { headers });

  it("uses the last X-Forwarded-For entry (the one added by the proxy)", () => {
    expect(getClientIp(req({ "x-forwarded-for": "9.9.9.9, 3.3.3.3" }))).toBe("3.3.3.3");
  });

  it("falls back to X-Real-IP, then to 'unknown'", () => {
    expect(getClientIp(req({ "x-real-ip": "4.4.4.4" }))).toBe("4.4.4.4");
    expect(getClientIp(req({}))).toBe("unknown");
  });
});
