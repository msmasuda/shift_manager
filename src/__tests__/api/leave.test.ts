import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = {
  shiftAssignment: { deleteMany: vi.fn() },
  leaveRecord: { upsert: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    leaveRecord: { findUnique: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "member-1", organizationId: "org-1", role: "MEMBER" },
  }),
}));

vi.mock("@/lib/date", () => ({ todayJST: () => "2024-06-15" }));

import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/leave/route";
import { DELETE } from "@/app/api/leave/[id]/route";

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/leave", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const deleteReq = () => new Request("http://localhost/api/leave/leave-1", { method: "DELETE" });
const params = Promise.resolve({ id: "leave-1" });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/leave", () => {
  it("400: past date", async () => {
    const res = await POST(makePostRequest({ date: "2024-06-14", type: "PAID_LEAVE" }));
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("201: deletes own shift and upserts leave in one transaction", async () => {
    tx.leaveRecord.upsert.mockResolvedValueOnce({ id: "leave-1" });

    const res = await POST(makePostRequest({ date: "2024-06-15", type: "PREFERRED_OFF" }));
    expect(res.status).toBe(201);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.shiftAssignment.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "member-1",
        scheduleDay: { organizationId: "org-1", date: new Date("2024-06-15") },
      },
    });
  });
});

describe("DELETE /api/leave/[id]", () => {
  it("404: another user's record", async () => {
    vi.mocked(prisma.leaveRecord.findUnique).mockResolvedValueOnce({
      id: "leave-1",
      userId: "other",
      date: new Date("2024-06-20"),
    } as any);

    const res = await DELETE(deleteReq(), { params });
    expect(res.status).toBe(404);
    expect(prisma.leaveRecord.delete).not.toHaveBeenCalled();
  });

  it("400: past date", async () => {
    vi.mocked(prisma.leaveRecord.findUnique).mockResolvedValueOnce({
      id: "leave-1",
      userId: "member-1",
      date: new Date("2024-06-14"),
    } as any);

    const res = await DELETE(deleteReq(), { params });
    expect(res.status).toBe(400);
    expect(prisma.leaveRecord.delete).not.toHaveBeenCalled();
  });

  it("204: own future record", async () => {
    vi.mocked(prisma.leaveRecord.findUnique).mockResolvedValueOnce({
      id: "leave-1",
      userId: "member-1",
      date: new Date("2024-06-20"),
    } as any);

    const res = await DELETE(deleteReq(), { params });
    expect(res.status).toBe(204);
  });
});
