import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";

const timeRegex = /^\d{2}:\d{2}$/;

const patchUserSchema = z
  .object({
    defaultStartTime: z.string().regex(timeRegex).nullable().optional(),
    defaultEndTime: z.string().regex(timeRegex).nullable().optional(),
  })
  .refine(
    (data) =>
      !data.defaultStartTime || !data.defaultEndTime
        ? true
        : data.defaultStartTime < data.defaultEndTime,
    {
      message: "defaultEndTime must be after defaultStartTime",
      path: ["defaultEndTime"],
    }
  );

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { organizationId } = session.user;
    const { id } = await params;

    const target = await prisma.user.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    if (!target || target.organizationId !== organizationId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = patchUserSchema.parse(body);

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        defaultStartTime: true,
        defaultEndTime: true,
      },
    });
    return NextResponse.json(user);
  } catch (error) {
    console.error("PATCH /api/users/[id] error:", error);
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
