import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";
import type { TimeGap } from "@/types";

const daysQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  to: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function toTimeStr(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function detectGapsForSession(
  shifts: { startTime: string; endTime: string }[],
  openTime: string,
  closeTime: string
): TimeGap[] {
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);
  if (open >= close) return [];

  const intervals = shifts
    .map((s) => [toMinutes(s.startTime), toMinutes(s.endTime)] as [number, number])
    .filter(([s, e]) => s < close && e > open)
    .map(([s, e]) => [Math.max(s, open), Math.min(e, close)] as [number, number])
    .sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const [s, e] of intervals) {
    if (merged.length === 0 || s > merged[merged.length - 1][1]) {
      merged.push([s, e]);
    } else {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
    }
  }

  const gaps: TimeGap[] = [];
  let cursor = open;
  for (const [s, e] of merged) {
    if (s > cursor) gaps.push({ start: toTimeStr(cursor), end: toTimeStr(s) });
    cursor = Math.max(cursor, e);
    if (cursor >= close) break;
  }
  if (cursor < close) gaps.push({ start: toTimeStr(cursor), end: toTimeStr(close) });

  return gaps;
}

function detectGaps(
  shifts: { startTime: string; endTime: string }[],
  openTime: string,
  closeTime: string,
  openTime2?: string | null,
  closeTime2?: string | null
): TimeGap[] {
  const gaps1 = detectGapsForSession(shifts, openTime, closeTime);
  const gaps2 = openTime2 && closeTime2
    ? detectGapsForSession(shifts, openTime2, closeTime2)
    : [];
  return [...gaps1, ...gaps2];
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { organizationId } = session.user;

    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    const { from, to } = daysQuerySchema.parse(params);

    const [org, days] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { openTime: true, closeTime: true, openTime2: true, closeTime2: true },
      }),
      prisma.scheduleDay.findMany({
        where: { organizationId, date: { gte: new Date(from), lte: new Date(to) } },
        orderBy: { date: "asc" },
        include: { shiftAssignments: true },
      }),
    ]);

    const result = days
      .map((d) => {
        const uniqueCount = new Set(d.shiftAssignments.map((a) => a.userId)).size;
        const insufficient = uniqueCount < d.minRequired;

        const effectiveOpen = d.openTime ?? org?.openTime ?? null;
        const effectiveClose = d.closeTime ?? org?.closeTime ?? null;
        const effectiveOpen2 = d.openTime2 ?? org?.openTime2 ?? null;
        const effectiveClose2 = d.closeTime2 ?? org?.closeTime2 ?? null;
        const gaps =
          effectiveOpen && effectiveClose
            ? detectGaps(d.shiftAssignments, effectiveOpen, effectiveClose, effectiveOpen2, effectiveClose2)
            : [];

        return {
          date: d.date,
          minRequired: d.minRequired,
          assignedCount: uniqueCount,
          insufficient,
          ...(effectiveOpen ? { openTime: effectiveOpen } : {}),
          ...(effectiveClose ? { closeTime: effectiveClose } : {}),
          gaps,
        };
      })
      .filter((w) => w.insufficient || w.gaps.length > 0);

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/schedule/warnings error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation Error", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
