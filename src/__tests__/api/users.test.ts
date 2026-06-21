import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn(), create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/users/route";

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  organizationId: "org-1",
  email: "alice@example.com",
  name: "Alice",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/users", () => {
  it("201: success", async () => {
    vi.mocked(prisma.user.create).mockResolvedValueOnce({
      id: "user-1",
      organizationId: "org-1",
      email: "alice@example.com",
      name: "Alice",
      role: "MEMBER",
    } as any);

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(201);
  });

  it("400: invalid email", async () => {
    const res = await POST(makePostRequest({ ...validBody, email: "not-an-email" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation Error");
  });

  it("400: missing name", async () => {
    const res = await POST(makePostRequest({ ...validBody, name: "" }));
    expect(res.status).toBe(400);
  });

  it("409: duplicate email in same organization (P2002)", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("unique constraint", {
      code: "P2002",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.user.create).mockRejectedValueOnce(p2002);

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/既に登録/);
  });
});
