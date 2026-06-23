import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";

const myShiftsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    const { from, to } = myShiftsQuerySchema.parse(params);

    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const assignments = await prisma.shiftAssignment.findMany({
      where: {
        userId,
        scheduleDay: {
          date: { gte: fromDate, lte: toDate },
        },
      },
      orderBy: { scheduleDay: { date: "asc" } },
      include: {
        scheduleDay: { select: { date: true, minRequired: true } },
      },
    });
    return NextResponse.json(assignments);
  } catch (error) {
    console.error("GET /api/shifts/my error:", error);
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
