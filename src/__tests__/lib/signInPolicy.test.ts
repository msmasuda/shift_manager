import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { allowSignIn } from "@/lib/signInPolicy";

const user = { email: "a@example.com" };
const google = { provider: "google", type: "oidc", providerAccountId: "g1" } as const;
const credentials = { provider: "credentials", type: "credentials", providerAccountId: "u1" } as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1" } as any);
});

describe("allowSignIn", () => {
  it("allows a registered user via Google with a verified email", async () => {
    await expect(
      allowSignIn({ user, account: google, profile: { email_verified: true } })
    ).resolves.toBe(true);
  });

  it("rejects Google sign-in when email_verified is false or missing", async () => {
    await expect(
      allowSignIn({ user, account: google, profile: { email_verified: false } })
    ).resolves.toBe(false);
    await expect(allowSignIn({ user, account: google, profile: {} })).resolves.toBe(false);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("does not require email_verified for credentials sign-in", async () => {
    await expect(allowSignIn({ user, account: credentials })).resolves.toBe(true);
  });

  it("rejects unregistered emails", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    await expect(
      allowSignIn({ user, account: google, profile: { email_verified: true } })
    ).resolves.toBe(false);
  });

  it("rejects users without an email", async () => {
    await expect(allowSignIn({ user: {}, account: credentials })).resolves.toBe(false);
  });
});
