import { describe, it, expect, vi, beforeEach } from "vitest";
import bcryptjs from "bcryptjs";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { verifyCredentials, DUMMY_PASSWORD_HASH } from "@/lib/credentials";

// テストを速くするためコスト 4 で作る（本番のハッシュはコスト 12）
const realHash = bcryptjs.hashSync("correct-password", 4);
const user = { id: "u1", email: "a@example.com", name: "A", passwordHash: realHash };

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("verifyCredentials", () => {
  it("returns the user without passwordHash for a correct password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
    await expect(verifyCredentials("a@example.com", "correct-password")).resolves.toEqual({
      id: "u1",
      email: "a@example.com",
      name: "A",
    });
  });

  it("returns null for a wrong password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
    await expect(verifyCredentials("a@example.com", "wrong")).resolves.toBeNull();
  });

  it("still runs bcrypt against the dummy hash when the user does not exist", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const compare = vi.spyOn(bcryptjs, "compare").mockResolvedValue(false as never);

    await expect(verifyCredentials("nobody@example.com", "x")).resolves.toBeNull();
    expect(compare).toHaveBeenCalledWith("x", DUMMY_PASSWORD_HASH);
  });

  it("still runs bcrypt when the user has no password (Google-only)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...user, passwordHash: null } as any);
    const compare = vi.spyOn(bcryptjs, "compare").mockResolvedValue(true as never);

    // ダミーと一致しても（=ダミーのパスワードを当てても）ログインさせない
    await expect(verifyCredentials("a@example.com", "x")).resolves.toBeNull();
    expect(compare).toHaveBeenCalledWith("x", DUMMY_PASSWORD_HASH);
  });

  it("dummy hash uses the same cost (12) as real password hashes", () => {
    expect(bcryptjs.getRounds(DUMMY_PASSWORD_HASH)).toBe(12);
  });
});
