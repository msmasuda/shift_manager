import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";

const putDayBodySchema = z.object({
  minRequired: z.number().int().min(0).or(z.string().regex(/^\d+$/).transform(Number)),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { organizationId } = session.user;

    const { date: dateStr } = await params;
    const body = await request.json();
    const { minRequired } = putDayBodySchema.parse(body);

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const day = await prisma.scheduleDay.upsert({
      where: {
        organizationId_date: { organizationId, date },
      },
      create: { organizationId, date, minRequired },
      update: { minRequired },
    });
    return NextResponse.json(day);
  } catch (error) {
    console.error("PUT /api/schedule/days/[date] error:", error);
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
