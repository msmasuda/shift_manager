import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";

const bulkFillSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  overwrite: z.boolean().optional().default(false),
  preview: z.boolean().optional().default(false),
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
    const { from, to, overwrite, preview } = bulkFillSchema.parse(body);

    const todayStr = new Date().toISOString().slice(0, 10);
    const dates = datesInRange(from, to).filter((d) => d >= todayStr);

    if (dates.length === 0) {
      return NextResponse.json({ created: 0, updated: 0 });
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
        include: { shiftAssignments: { select: { id: true, userId: true } } },
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
          assignmentsByUserId: new Map(d.shiftAssignments.map((a) => [a.userId, a.id])),
        },
      ])
    );
    const leaveSet = new Set(
      leaveRecords.map((l) => `${l.userId}|${l.date.toISOString().slice(0, 10)}`)
    );

    const fillPlan = dates.flatMap((dateStr) => {
      const existing = existingDaysMap.get(dateStr);
      if (existing?.isHoliday) return [];

      return members
        .filter((member) => !leaveSet.has(`${member.id}|${dateStr}`))
        .map((member) => ({
          dateStr,
          member,
          scheduleDayId: existing?.id,
          assignmentId: existing?.assignmentsByUserId.get(member.id),
        }));
    });

    const createdCount = fillPlan.filter((item) => !item.assignmentId).length;
    const updatedCount = overwrite
      ? fillPlan.filter((item) => Boolean(item.assignmentId)).length
      : 0;

    if (preview) {
      return NextResponse.json({ created: createdCount, updated: updatedCount });
    }

    const resultCounts = await prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      for (const dateStr of dates) {
        const existing = existingDaysMap.get(dateStr);
        if (existing?.isHoliday) continue;

        const eligibleMembers = members.filter(
          (member) => !leaveSet.has(`${member.id}|${dateStr}`)
        );
        const membersToFill = eligibleMembers.filter(
          (member) => !existing?.assignmentsByUserId.has(member.id)
        );
        const membersToOverwrite = overwrite
          ? eligibleMembers.filter((member) => existing?.assignmentsByUserId.has(member.id))
          : [];
        if (membersToFill.length === 0 && membersToOverwrite.length === 0) continue;

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

        if (membersToFill.length > 0) {
          const result = await tx.shiftAssignment.createMany({
            data: membersToFill.map((m) => ({
              scheduleDayId,
              userId: m.id,
              startTime: m.defaultStartTime!,
              endTime: m.defaultEndTime!,
            })),
            skipDuplicates: true,
          });
          created += result.count;
        }

        for (const member of membersToOverwrite) {
          await tx.shiftAssignment.update({
            where: { id: existing!.assignmentsByUserId.get(member.id)! },
            data: {
              startTime: member.defaultStartTime!,
              endTime: member.defaultEndTime!,
            },
          });
          updated++;
        }
      }
      return { created, updated };
    });

    return NextResponse.json(resultCounts);
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
