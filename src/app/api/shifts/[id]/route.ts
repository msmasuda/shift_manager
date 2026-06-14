import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

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
    const { id } = await params;
    const body = await request.json();
    const updates = updateShiftSchema.parse(body);

    const assignment = await prisma.shiftAssignment.findUnique({
      where: { id },
    });
    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const data: { scheduleDayId?: string; userId?: string; startTime?: string; endTime?: string } = {};
    if (updates.userId !== undefined) data.userId = updates.userId;
    if (updates.startTime !== undefined) data.startTime = updates.startTime;
    if (updates.endTime !== undefined) data.endTime = updates.endTime;

    if (updates.date !== undefined) {
      const dateObj = new Date(updates.date);
      if (isNaN(dateObj.getTime())) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      }
      const org = await prisma.scheduleDay.findUnique({
        where: { id: assignment.scheduleDayId },
        select: { organizationId: true },
      });
      if (!org) {
        return NextResponse.json({ error: "Schedule day not found" }, { status: 404 });
      }

      const scheduleDay = await prisma.scheduleDay.upsert({
        where: {
          organizationId_date: { organizationId: org.organizationId, date: dateObj },
        },
        create: { organizationId: org.organizationId, date: dateObj, minRequired: 1 },
        update: {},
      });
      data.scheduleDayId = scheduleDay.id;
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
    const { id } = await params;
    await prisma.shiftAssignment.delete({ where: { id } }).catch(() => null);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/shifts/[id] error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
