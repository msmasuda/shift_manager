import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const updateShiftSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/).optional(),
  userId: z.string().min(1).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const sessionOrgId = session.user.organizationId;

    const { id } = await params;
    const body = await request.json();
    const updates = updateShiftSchema.parse(body);

    const assignment = await prisma.shiftAssignment.findUnique({
      where: { id },
      include: { scheduleDay: { select: { organizationId: true } } },
    });
    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const { organizationId } = assignment.scheduleDay;
    if (organizationId !== sessionOrgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data: { scheduleDayId?: string; userId?: string; startTime?: string; endTime?: string } = {};

    if (updates.userId !== undefined) {
      const user = await prisma.user.findUnique({
        where: { id: updates.userId },
        select: { organizationId: true },
      });
      if (!user || user.organizationId !== organizationId) {
        return NextResponse.json({ error: "User not found in organization" }, { status: 400 });
      }
      data.userId = updates.userId;
    }

    if (updates.startTime !== undefined) data.startTime = updates.startTime;
    if (updates.endTime !== undefined) data.endTime = updates.endTime;

    // Validate time ordering against effective values (updated or existing)
    const effectiveStart = updates.startTime ?? assignment.startTime;
    const effectiveEnd = updates.endTime ?? assignment.endTime;
    if (effectiveStart >= effectiveEnd) {
      return NextResponse.json({ error: "endTime must be after startTime" }, { status: 400 });
    }

    if (updates.date !== undefined) {
      const dateObj = new Date(updates.date);
      if (isNaN(dateObj.getTime())) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      }

      const scheduleDay = await prisma.scheduleDay.upsert({
        where: {
          organizationId_date: { organizationId, date: dateObj },
        },
        create: { organizationId, date: dateObj, minRequired: 0 },
        update: {},
      });
      data.scheduleDayId = scheduleDay.id;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.shiftAssignment.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true } },
        scheduleDay: { select: { date: true, minRequired: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/shifts/[id] error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation Error", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await prisma.shiftAssignment.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }
    console.error("DELETE /api/shifts/[id] error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
