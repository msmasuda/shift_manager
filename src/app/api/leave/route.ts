import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";
import { todayJST } from "@/lib/date";

const postSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["PREFERRED_OFF", "PAID_LEAVE"]),
});

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { organizationId, id: userId } = session.user;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const records = await prisma.leaveRecord.findMany({
      where: {
        organizationId,
        userId,
        ...(from && to ? { date: { gte: new Date(from), lte: new Date(to) } } : {}),
      },
      orderBy: { date: "asc" },
    });
    return NextResponse.json(records);
  } catch (error) {
    console.error("GET /api/leave error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { organizationId, id: userId } = session.user;

    const body = await request.json();
    const { date: dateStr, type } = postSchema.parse(body);
    if (dateStr < todayJST()) {
      return NextResponse.json({ error: "過去の日付には登録できません" }, { status: 400 });
    }
    const date = new Date(dateStr);

    // 同じ日のシフトがあれば削除し、休みを登録する（途中で失敗してもシフトだけ消えないよう1トランザクションで）
    const record = await prisma.$transaction(async (tx) => {
      await tx.shiftAssignment.deleteMany({
        where: { userId, scheduleDay: { organizationId, date } },
      });
      return tx.leaveRecord.upsert({
        where: { userId_date: { userId, date } },
        create: { organizationId, userId, date, type },
        update: { type },
      });
    });
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("POST /api/leave error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation Error", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
