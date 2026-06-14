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
      include: {
        shiftAssignments: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    return NextResponse.json(days);
  } catch (error) {
    console.error("GET /api/schedule/days error:", error);
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
