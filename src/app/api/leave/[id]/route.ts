import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { todayJST } from "@/lib/date";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: userId } = session.user;
    const { id } = await params;

    const record = await prisma.leaveRecord.findUnique({ where: { id } });
    if (!record || record.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (record.date.toISOString().slice(0, 10) < todayJST()) {
      return NextResponse.json({ error: "過去の日付は取り消せません" }, { status: 400 });
    }

    await prisma.leaveRecord.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/leave/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
