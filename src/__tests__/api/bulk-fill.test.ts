import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const txMock = {
  scheduleDay: { upsert: vi.fn() },
  shiftAssignment: { createMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn() },
    scheduleDay: { findMany: vi.fn() },
    leaveRecord: { findMany: vi.fn() },
    $transaction: vi.fn((cb: any) => cb(txMock)),
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "admin-1", organizationId: "org-1", role: "ADMIN" },
  }),
}));

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { POST } from "@/app/api/schedule/bulk-fill/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/schedule/bulk-fill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation((cb: any) => cb(txMock));
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-15T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/schedule/bulk-fill", () => {
  it("403: non-admin", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "member-1", organizationId: "org-1", role: "MEMBER" },
    } as any);

    const res = await POST(makeRequest({ from: "2026-01-16", to: "2026-01-17" }));
    expect(res.status).toBe(403);
  });

  it("400: invalid date format", async () => {
    const res = await POST(makeRequest({ from: "not-a-date", to: "2026-01-17" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation Error");
  });

  it("created: 0 when no members have default times set", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.scheduleDay.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.leaveRecord.findMany).mockResolvedValueOnce([]);

    const res = await POST(makeRequest({ from: "2026-01-16", to: "2026-01-16" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(0);
    expect(txMock.shiftAssignment.createMany).not.toHaveBeenCalled();
  });

  it("skips days entirely in the past", async () => {
    // 2026-01-15 is "today" (fake system time); this range is entirely before it.
    // The route should short-circuit before querying members/days/leave records at all.
    const res = await POST(makeRequest({ from: "2026-01-10", to: "2026-01-14" }));
    const body = await res.json();
    expect(body.created).toBe(0);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.scheduleDay.findMany).not.toHaveBeenCalled();
    expect(prisma.leaveRecord.findMany).not.toHaveBeenCalled();
  });

  it("excludes holiday days, existing assignments, and leave records", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: "user-1", defaultStartTime: "10:00", defaultEndTime: "19:00" },
      { id: "user-2", defaultStartTime: "12:00", defaultEndTime: "20:00" },
    ] as any);
    vi.mocked(prisma.scheduleDay.findMany).mockResolvedValueOnce([
      {
        id: "day-16",
        date: new Date("2026-01-16T00:00:00.000Z"),
        isHoliday: false,
        shiftAssignments: [{ userId: "user-1" }], // user-1 already assigned on 1/16
      },
      {
        id: "day-17",
        date: new Date("2026-01-17T00:00:00.000Z"),
        isHoliday: true, // holiday: nobody gets filled
        shiftAssignments: [],
      },
    ] as any);
    vi.mocked(prisma.leaveRecord.findMany).mockResolvedValueOnce([
      { userId: "user-2", date: new Date("2026-01-16T00:00:00.000Z") }, // user-2 off on 1/16
    ] as any);
    txMock.scheduleDay.upsert.mockResolvedValueOnce({ id: "day-18" });
    txMock.shiftAssignment.createMany.mockResolvedValueOnce({ count: 2 });

    // range: 1/16 (existing day, holiday=false), 1/17 (holiday), 1/18 (no ScheduleDay row yet)
    const res = await POST(makeRequest({ from: "2026-01-16", to: "2026-01-18" }));
    expect(res.status).toBe(200);
    const body = await res.json();

    // 1/16: user-1 skipped (already assigned), user-2 skipped (leave) => 0 created
    // 1/17: holiday => 0 created
    // 1/18: no existing day => both user-1 and user-2 filled => 2 created
    expect(body.created).toBe(2);
    expect(txMock.scheduleDay.upsert).toHaveBeenCalledTimes(1);
    expect(txMock.shiftAssignment.createMany).toHaveBeenCalledTimes(1);
    expect(txMock.shiftAssignment.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        { scheduleDayId: "day-18", userId: "user-1", startTime: "10:00", endTime: "19:00" },
        { scheduleDayId: "day-18", userId: "user-2", startTime: "12:00", endTime: "20:00" },
      ]),
      skipDuplicates: true,
    });
  });
});
