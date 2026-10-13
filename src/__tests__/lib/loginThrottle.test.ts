import { describe, it, expect } from "vitest";
import { isLockedOut, recordLoginFailure, clearLoginFailures } from "@/lib/loginThrottle";

describe("loginThrottle", () => {
  it("locks after 5 failures, unlocks after 15 minutes or on success", () => {
    const t = 1_000_000;
    for (let i = 0; i < 4; i++) recordLoginFailure("A@example.com", t);
    expect(isLockedOut("a@example.com", t)).toBe(false);
    recordLoginFailure("a@example.com", t);
    expect(isLockedOut("a@example.com", t)).toBe(true);
    expect(isLockedOut("a@example.com", t + 15 * 60 * 1000 + 1)).toBe(false);

    for (let i = 0; i < 5; i++) recordLoginFailure("b@example.com", t);
    clearLoginFailures("b@example.com");
    expect(isLockedOut("b@example.com", t)).toBe(false);
  });
});
