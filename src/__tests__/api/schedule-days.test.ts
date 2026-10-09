import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { scheduleDay: { upsert: vi.fn() }, $transaction: vi.fn() },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "member-1", organizationId: "org-1", role: "MEMBER" },
  }),
}));

import { prisma } from "@/lib/prisma";
import { PUT } from "@/app/api/schedule/days/[date]/route";

describe("PUT /api/schedule/days/[date]", () => {
  it("403: non-admin cannot mark a holiday", async () => {
    const req = new Request("http://localhost/api/schedule/days/2024-06-15", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHoliday: true }),
    });
    const res = await PUT(req, { params: Promise.resolve({ date: "2024-06-15" }) });
    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.scheduleDay.upsert).not.toHaveBeenCalled();
  });
});
