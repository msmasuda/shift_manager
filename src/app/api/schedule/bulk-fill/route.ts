import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";

const bulkFillSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function datesInRange(fromStr: string, toStr: string): string[] {
  const dates: string[] = [];
  const cur = new Date(fromStr + "T00:00:00.000Z");
  const end = new Date(toStr + "T00:00:00.000Z");
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { organizationId } = session.user;

    const body = await request.json();
    const { from, to } = bulkFillSchema.parse(body);

    const todayStr = new Date().toISOString().slice(0, 10);
    const dates = datesInRange(from, to).filter((d) => d >= todayStr);

    if (dates.length === 0) {
      return NextResponse.json({ created: 0 });
    }

    const fromDate = new Date(from + "T00:00:00.000Z");
    const toDate = new Date(to + "T00:00:00.000Z");

    const [members, existingDays, leaveRecords] = await Promise.all([
      prisma.user.findMany({
        where: {
          organizationId,
          defaultStartTime: { not: null },
          defaultEndTime: { not: null },
        },
        select: { id: true, defaultStartTime: true, defaultEndTime: true },
      }),
      prisma.scheduleDay.findMany({
        where: { organizationId, date: { gte: fromDate, lte: toDate } },
        include: { shiftAssignments: { select: { userId: true } } },
      }),
      prisma.leaveRecord.findMany({
        where: { organizationId, date: { gte: fromDate, lte: toDate } },
        select: { userId: true, date: true },
      }),
    ]);

    const existingDaysMap = new Map(
      existingDays.map((d) => [
        d.date.toISOString().slice(0, 10),
        {
          id: d.id,
          isHoliday: d.isHoliday,
          assignedUserIds: new Set(d.shiftAssignments.map((a) => a.userId)),
        },
      ])
    );
    const leaveSet = new Set(
      leaveRecords.map((l) => `${l.userId}|${l.date.toISOString().slice(0, 10)}`)
    );

    const created = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const dateStr of dates) {
        const existing = existingDaysMap.get(dateStr);
        if (existing?.isHoliday) continue;

        const membersToFill = members.filter(
          (m) =>
            !leaveSet.has(`${m.id}|${dateStr}`) &&
            !existing?.assignedUserIds.has(m.id)
        );
        if (membersToFill.length === 0) continue;

        const scheduleDayId = existing
          ? existing.id
          : (
              await tx.scheduleDay.upsert({
                where: {
                  organizationId_date: {
                    organizationId,
                    date: new Date(dateStr + "T00:00:00.000Z"),
                  },
                },
                create: {
                  organizationId,
                  date: new Date(dateStr + "T00:00:00.000Z"),
                  minRequired: 0,
                },
                update: {},
              })
            ).id;

        await tx.shiftAssignment.createMany({
          data: membersToFill.map((m) => ({
            scheduleDayId,
            userId: m.id,
            startTime: m.defaultStartTime!,
            endTime: m.defaultEndTime!,
          })),
        });
        count += membersToFill.length;
      }
      return count;
    });

    return NextResponse.json({ created });
  } catch (error) {
    console.error("POST /api/schedule/bulk-fill error:", error);
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
