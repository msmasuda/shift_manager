import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { organization: { findUnique: vi.fn(), update: vi.fn() } },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "admin-1", organizationId: "org-1", role: "ADMIN" },
  }),
}));

import { prisma } from "@/lib/prisma";
import { GET, PATCH } from "@/app/api/organizations/[id]/route";

const otherOrg = { params: Promise.resolve({ id: "org-OTHER" }) };

describe("/api/organizations/[id]", () => {
  it("GET 403: another organization", async () => {
    const res = await GET(new Request("http://localhost"), otherOrg);
    expect(res.status).toBe(403);
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("PATCH 403: another organization", async () => {
    const req = new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    });
    const res = await PATCH(req, otherOrg);
    expect(res.status).toBe(403);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });
});
