import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const querySchema = z.object({
  organizationId: z.string().min(1, "organizationId is required"),
});

const createUserSchema = z.object({
  organizationId: z.string().min(1, "organizationId is required"),
  email: z.string().email("Invalid email"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["ADMIN", "MEMBER"]).optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    const { organizationId } = querySchema.parse(params);

    const users = await prisma.user.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error("GET /api/users error:", error);
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizationId, email, name, role } = createUserSchema.parse(body);

    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name,
        role: role ?? "MEMBER",
      },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("POST /api/users error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation Error", details: error.errors },
        { status: 400 }
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "このメールアドレスは既に登録されています" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
