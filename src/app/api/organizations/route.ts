import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createOrgSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export async function GET() {
  try {
    const orgs = await prisma.organization.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(orgs);
  } catch (error) {
    console.error("GET /api/organizations error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name } = createOrgSchema.parse(body);
    const org = await prisma.organization.create({
      data: { name },
    });
    return NextResponse.json(org, { status: 201 });
  } catch (error) {
    console.error("POST /api/organizations error:", error);
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
