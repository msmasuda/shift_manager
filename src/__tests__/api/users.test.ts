import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "admin-1", organizationId: "org-1", role: "ADMIN" },
  }),
}));

import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/users/route";
import { PATCH } from "@/app/api/users/[id]/route";

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
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

function makePatchRequest(body: unknown) {
  return new Request("http://localhost/api/users/user-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const patchParams = Promise.resolve({ id: "user-1" });

describe("PATCH /api/users/[id]", () => {
  it("403: non-admin", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "member-1", organizationId: "org-1", role: "MEMBER" },
    } as any);

    const res = await PATCH(makePatchRequest({ defaultStartTime: "10:00" }), {
      params: patchParams,
    });
    expect(res.status).toBe(403);
  });

  it("404: user not in organization", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      organizationId: "org-OTHER",
    } as any);

    const res = await PATCH(makePatchRequest({ defaultStartTime: "10:00" }), {
      params: patchParams,
    });
    expect(res.status).toBe(404);
  });

  it("400: defaultEndTime before defaultStartTime", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      organizationId: "org-1",
    } as any);

    const res = await PATCH(
      makePatchRequest({ defaultStartTime: "18:00", defaultEndTime: "09:00" }),
      { params: patchParams }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation Error");
  });

  it("200: success setting both times", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      organizationId: "org-1",
    } as any);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      role: "MEMBER",
      defaultStartTime: "10:00",
      defaultEndTime: "19:00",
    } as any);

    const res = await PATCH(
      makePatchRequest({ defaultStartTime: "10:00", defaultEndTime: "19:00" }),
      { params: patchParams }
    );
    expect(res.status).toBe(200);
  });

  it("200: success clearing both times (null)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      organizationId: "org-1",
    } as any);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      role: "MEMBER",
      defaultStartTime: null,
      defaultEndTime: null,
    } as any);

    const res = await PATCH(
      makePatchRequest({ defaultStartTime: null, defaultEndTime: null }),
      { params: patchParams }
    );
    expect(res.status).toBe(200);
  });
});
