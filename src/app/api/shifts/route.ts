import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createShiftSchema = z
  .object({
    organizationId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/),
    userId: z.string().min(1),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .refine(({ startTime, endTime }) => startTime < endTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizationId, date, userId, startTime, endTime } = createShiftSchema.parse(body);
    const dateObj = new Date(date);

    if (isNaN(dateObj.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
    if (!user || user.organizationId !== organizationId) {
      return NextResponse.json({ error: "User not found in organization" }, { status: 400 });
    }

    const scheduleDay = await prisma.scheduleDay.upsert({
      where: {
        organizationId_date: { organizationId, date: dateObj },
      },
      create: { organizationId, date: dateObj, minRequired: 0 },
      update: {},
    });

    const duplicate = await prisma.shiftAssignment.findFirst({
      where: { scheduleDayId: scheduleDay.id, userId },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "このユーザーは既にこの日にアサインされています" },
        { status: 409 }
      );
    }

    const assignment = await prisma.shiftAssignment.create({
      data: {
        scheduleDayId: scheduleDay.id,
        userId,
        startTime,
        endTime,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        scheduleDay: { select: { date: true, minRequired: true } },
      },
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error("POST /api/shifts error:", error);
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
