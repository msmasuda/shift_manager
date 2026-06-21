import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const daysQuerySchema = z.object({
  organizationId: z.string().min(1),
  from: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  to: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    const { organizationId, from, to } = daysQuerySchema.parse(params);
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const days = await prisma.scheduleDay.findMany({
      where: {
        organizationId,
        date: { gte: fromDate, lte: toDate },
      },
      orderBy: { date: "asc" },
      include: { shiftAssignments: true },
    });

    const result = days
      .map((d) => {
        const uniqueCount = new Set(d.shiftAssignments.map((a) => a.userId)).size;
        return {
          date: d.date,
          minRequired: d.minRequired,
          assignedCount: uniqueCount,
          insufficient: uniqueCount < d.minRequired,
        };
      })
      .filter((w) => w.insufficient);

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/schedule/warnings error:", error);
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
