import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    scheduleDay: { upsert: vi.fn() },
    shiftAssignment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
  }),
}));

import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/shifts/route";
import {
  PATCH,
  DELETE,
} from "@/app/api/shifts/[id]/route";

const mockUser = { organizationId: "org-1" };
const mockScheduleDay = { id: "day-1", organizationId: "org-1" };
const mockAssignment = {
  id: "assign-1",
  scheduleDayId: "day-1",
  userId: "user-1",
  startTime: "09:00",
  endTime: "18:00",
  scheduleDay: { organizationId: "org-1" },
};

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/shifts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePatchRequest(body: unknown) {
  return new Request("http://localhost/api/shifts/assign-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest() {
  return new Request("http://localhost/api/shifts/assign-1", {
    method: "DELETE",
  });
}

const patchParams = Promise.resolve({ id: "assign-1" });
const deleteParams = Promise.resolve({ id: "assign-1" });

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// POST /api/shifts
// ---------------------------------------------------------------------------
describe("POST /api/shifts", () => {
  const validBody = {
    date: "2024-06-15",
    userId: "user-1",
    startTime: "09:00",
    endTime: "18:00",
  };

  it("400: startTime >= endTime", async () => {
    const res = await POST(
      makePostRequest({ ...validBody, startTime: "18:00", endTime: "09:00" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation Error");
  });

  it("400: startTime === endTime", async () => {
    const res = await POST(
      makePostRequest({ ...validBody, startTime: "09:00", endTime: "09:00" })
    );
    expect(res.status).toBe(400);
  });

  it("400: userId not in organization", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      organizationId: "org-OTHER",
    } as any);

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not found in organization/i);
  });

  it("400: userId does not exist", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(400);
  });

  it("409: user already assigned on this day", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any);
    vi.mocked(prisma.scheduleDay.upsert).mockResolvedValueOnce(mockScheduleDay as any);
    vi.mocked(prisma.shiftAssignment.findFirst).mockResolvedValueOnce(mockAssignment as any);

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/既にこの日にアサイン/);
  });

  it("201: success", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any);
    vi.mocked(prisma.scheduleDay.upsert).mockResolvedValueOnce(mockScheduleDay as any);
    vi.mocked(prisma.shiftAssignment.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.shiftAssignment.create).mockResolvedValueOnce({
      ...mockAssignment,
      user: { id: "user-1", name: "Alice", email: "alice@example.com" },
      scheduleDay: { date: new Date("2024-06-15"), minRequired: 0 },
    } as any);

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/shifts/[id]
// ---------------------------------------------------------------------------
describe("PATCH /api/shifts/[id]", () => {
  it("404: assignment not found", async () => {
    vi.mocked(prisma.shiftAssignment.findUnique).mockResolvedValueOnce(null);

    const res = await PATCH(makePatchRequest({ startTime: "10:00" }), {
      params: patchParams,
    });
    expect(res.status).toBe(404);
  });

  it("400: no fields to update", async () => {
    vi.mocked(prisma.shiftAssignment.findUnique).mockResolvedValueOnce(
      mockAssignment as any
    );

    const res = await PATCH(makePatchRequest({}), { params: patchParams });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/No fields to update/);
  });

  it("400: new userId not in organization", async () => {
    vi.mocked(prisma.shiftAssignment.findUnique).mockResolvedValueOnce(
      mockAssignment as any
    );
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      organizationId: "org-OTHER",
    } as any);

    const res = await PATCH(makePatchRequest({ userId: "user-other" }), {
      params: patchParams,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not found in organization/i);
  });

  it("400: effective endTime <= startTime after update", async () => {
    vi.mocked(prisma.shiftAssignment.findUnique).mockResolvedValueOnce(
      // existing: 09:00 - 18:00
      mockAssignment as any
    );

    // updating only startTime to 18:00 — now startTime === endTime
    const res = await PATCH(makePatchRequest({ startTime: "18:00" }), {
      params: patchParams,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/endTime must be after startTime/);
  });

  it("200: success updating startTime", async () => {
    vi.mocked(prisma.shiftAssignment.findUnique).mockResolvedValueOnce(
      mockAssignment as any
    );
    vi.mocked(prisma.shiftAssignment.update).mockResolvedValueOnce({
      ...mockAssignment,
      startTime: "10:00",
    } as any);

    const res = await PATCH(makePatchRequest({ startTime: "10:00" }), {
      params: patchParams,
    });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/shifts/[id]
// ---------------------------------------------------------------------------
describe("DELETE /api/shifts/[id]", () => {
  it("204: success", async () => {
    vi.mocked(prisma.shiftAssignment.delete).mockResolvedValueOnce(
      mockAssignment as any
    );

    const res = await DELETE(makeDeleteRequest(), { params: deleteParams });
    expect(res.status).toBe(204);
  });

  it("404: assignment not found (P2025)", async () => {
    const p2025 = new Prisma.PrismaClientKnownRequestError("record not found", {
      code: "P2025",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.shiftAssignment.delete).mockRejectedValueOnce(p2025);

    const res = await DELETE(makeDeleteRequest(), { params: deleteParams });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});
